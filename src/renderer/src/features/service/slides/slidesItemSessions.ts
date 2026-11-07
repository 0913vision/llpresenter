import type {LlpApi} from '@contracts/ipc/api';
import type {SlidesEditorTarget} from '@contracts/ipc/slidesEditor';
import {isItemOfKind} from '@core/schema/service';
import {
  SlidesDraft,
  mergeSlidesChanges,
  type Slide,
  type SlidesItem,
} from '@core/services/slidesEdits';
import {SlideListClipboard} from '@core/songs/slideListModel';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {updateServiceItem} from '@renderer/session/serviceItemUpdate';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {SlidesListSession} from './slidesListSession';
import {editorTask} from '../../songs/editor/editorTask';

interface Entry {
  readonly target: SlidesEditorTarget;
  readonly session: SlidesListSession;
  readonly access: {readOnly: boolean; blocked: boolean};
  stop: () => void;
  queued: Promise<boolean> | undefined;
}

/** One item model per target, with serialized automatic writes across the service. */
export class SlidesItemSessions {
  private readonly entries = new Map<string, Entry>();
  private readonly clipboard = new SlideListClipboard<Slide>();
  private readonly listeners = new Set<() => void>();
  private tail = Promise.resolve(true);
  private version = 0;
  private active: SlidesListSession | null = null;
  private alive = true;

  constructor(
    private readonly api: LlpApi | undefined,
    private readonly report: (notice: Notice) => void,
  ) {}
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly getSnapshot = (): number => this.version;
  activate(): void {
    this.alive = true;
  }
  pin(session: SlidesListSession | null): void {
    this.active = session;
  }

  readonly sessionFor = (
    item: SlidesItem,
    target: SlidesEditorTarget,
    readOnly = false,
  ): SlidesListSession => {
    const key = `${target.serviceId}:${item.id}`;
    const previous = this.entries.get(key);
    if (
      previous !== undefined &&
      (previous.session === this.active ||
        previous.queued !== undefined ||
        previous.session.draft.dirty ||
        previous.session.draft.matchesSaved(item))
    ) {
      previous.access.readOnly = readOnly;
      return previous.session;
    }
    previous?.stop();
    const access = {readOnly, blocked: false};
    const draft = new SlidesDraft(item, this.clipboard);
    const session = new SlidesListSession(draft, {
      locked: () =>
        access.readOnly ||
        access.blocked ||
        this.api === undefined ||
        pendingWritesOf(this.api).isStopped,
      problem: title => this.problem(title),
    });
    const entry: Entry = {
      target,
      session,
      access,
      stop: () => undefined,
      queued: undefined,
    };
    entry.stop = draft.model.subscribe(() => {
      this.publish();
      if (!entry.access.blocked) editorTask(this.save(entry));
    });
    this.entries.set(key, entry);
    if (this.entries.size > 32) {
      for (const [id, candidate] of this.entries) {
        if (
          candidate !== entry &&
          candidate.session !== this.active &&
          candidate.queued === undefined &&
          !candidate.session.draft.dirty
        ) {
          candidate.stop();
          this.entries.delete(id);
          break;
        }
      }
    }
    return session;
  };

  readonly flush = async (): Promise<boolean> => {
    const results = await Promise.all(
      [...this.entries.values()].map(entry => this.save(entry)),
    );
    return results.every(Boolean);
  };

  dispose(): void {
    this.alive = false;
    for (const entry of this.entries.values()) entry.stop();
    this.entries.clear();
    this.listeners.clear();
  }

  private save(entry: Entry): Promise<boolean> {
    if (entry.queued !== undefined) return entry.queued;
    if (!entry.session.draft.dirty) return Promise.resolve(true);
    if (this.api === undefined || entry.access.blocked) {
      return Promise.resolve(false);
    }
    const work = pendingWritesOf(this.api).run({
      write: () => this.tail.then(() => this.drain(entry)),
      refused: false,
      sent: result => result,
    });
    entry.queued = work;
    this.tail = work.catch(() => false);
    editorTask(
      work.finally(() => {
        entry.queued = undefined;
        this.publish();
        if (
          this.alive &&
          !entry.access.blocked &&
          entry.session.draft.dirty &&
          this.api !== undefined &&
          !pendingWritesOf(this.api).isStopped
        ) {
          editorTask(this.save(entry));
        }
      }),
    );
    return work;
  }

  private async drain(entry: Entry): Promise<boolean> {
    const api = this.api;
    if (api === undefined) return false;
    const draft = entry.session.draft;
    while (draft.dirty) {
      const capture = draft.snapshot.item;
      const base = draft.base;
      const outcome = {conflict: false};
      const result = await updateServiceItem(api, {
        ...entry.target,
        change: item => {
          if (!isItemOfKind(item, 'slides')) return null;
          const merged = mergeSlidesChanges(base, capture, item);
          outcome.conflict = merged === null;
          return merged;
        },
      });
      if (!result.ok) {
        entry.access.blocked = true;
        this.problem(
          outcome.conflict
            ? '다른 창에서 같은 내용을 바꿨습니다'
            : '슬라이드 저장 실패',
        );
        return false;
      }
      draft.markSaved(capture, false);
    }
    return true;
  }

  private retryBlocked(): void {
    for (const entry of this.entries.values()) entry.access.blocked = false;
    editorTask(this.flush());
    this.publish();
  }

  private problem(title: string): void {
    if (!this.alive) return;
    const blocked = [...this.entries.values()].some(
      entry => entry.access.blocked,
    );
    this.report({
      key: 'slides-editor',
      kind: 'warning',
      icon: 'warning',
      title,
      time: noticeTime(),
      ...(!blocked
        ? {}
        : {
            actions: [
              {
                icon: 'refresh',
                label: '다시 시도',
                onSelect: () => {
                  this.retryBlocked();
                },
              },
            ],
          }),
    });
  }
  private publish(): void {
    if (!this.alive) return;
    this.version++;
    for (const listener of this.listeners) listener();
  }
}
