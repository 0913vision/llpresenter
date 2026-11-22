import type {LlpApi} from '@contracts/ipc/api';
import {LabelCatalog} from '@renderer/features/labels/labelCatalog';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import {CloseFlush} from './closeFlush';

// NOTE(0913vision): Commit-mode fields save on blur, so a close blurs the
// focused field before it asks about drafts or stops the write gate.
function commitFocusedField(): void {
  const focused = document.activeElement;
  if (focused instanceof HTMLElement) focused.blur();
}

/** What a window owns for as long as it is open: its notices and its labels. */
export class ControlSession {
  private notices: readonly Notice[] = [];
  private readonly listeners = new Set<() => void>();
  private closing = false;
  private generation = 0;
  /** Answers main's flush before closing and holds the 저장 중 dialog. */
  readonly closeFlush: CloseFlush | undefined;
  readonly labels: LabelCatalog | undefined;

  constructor(readonly api: LlpApi | undefined) {
    this.labels = api && new LabelCatalog(api, this.report);
    this.closeFlush =
      api &&
      new CloseFlush({
        api,
        flush: () => this.flushBeforeClose(),
        decide: () => this.settleDrafts(api),
      });
  }

  readonly getNotices = (): readonly Notice[] => this.notices;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  readonly report = (notice: Notice): void => {
    if (this.closing) return;
    this.notices = addNotice(this.notices, {
      ...notice,
      actions: notice.actions?.map(action => ({
        ...action,
        onSelect: () => {
          this.dismiss(notice.key);
          action.onSelect();
        },
      })),
    });
    this.publish();
  };
  readonly dismiss = (key: string): void => {
    this.notices = removeNotice(this.notices, key);
    this.publish();
  };

  /** Restarts editing when a retained settings window opens after a close. */
  resume(): void {
    if (this.closing) return;
    this.generation++;
    if (this.api !== undefined) pendingWritesOf(this.api).resume();
    this.closeFlush?.resume();
  }

  /** Releases what the window held, including the close flush answer. */
  dispose(): void {
    this.closeFlush?.dispose();
    this.closing = true;
    this.labels?.dispose();
    this.notices = [];
    this.listeners.clear();
  }

  private settleDrafts(api: LlpApi): Promise<DraftOutcome> | undefined {
    commitFocusedField();
    const writes = pendingWritesOf(api);
    return writes.hasDrafts ? writes.settleDrafts() : undefined;
  }

  // NOTE(0913vision): The close goes on only after every edit of this window
  // reached the main process and main wrote it to disk.
  private async flushBeforeClose(): Promise<boolean> {
    const generation = this.generation;
    commitFocusedField();
    const writes =
      this.api === undefined ? undefined : pendingWritesOf(this.api);
    let flushed = false;
    try {
      const sent = (await writes?.flush()) ?? true;
      flushed = sent && (await this.api?.app.savePending()) === true;
      return flushed;
    } finally {
      if (generation === this.generation && !flushed) writes?.resume();
    }
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
