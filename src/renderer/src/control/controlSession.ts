import type {LlpApi} from '@shared/ipc';
import {SongEditorStore} from '@renderer/prep/editor';
import {ServiceItemStore} from '@renderer/prep/service/serviceItemStore';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';
import {CloseFlush} from './closeFlush';

declare global {
  interface Window {
    __llpSongEditorStore?: SongEditorStore;
  }
}

/** Window-owned editor sessions and their shared notification destination. */
export class ControlSession {
  private editorStore: SongEditorStore | undefined;
  private itemStore: ServiceItemStore | undefined;
  private notices: readonly Notice[] = [];
  private readonly listeners = new Set<() => void>();
  private closing: Promise<void> | undefined;
  private editorBlocked = false;
  /** Answers main's flush before closing and holds the 저장 중 dialog. */
  readonly closeFlush: CloseFlush | undefined;

  constructor(readonly api: LlpApi | undefined) {
    this.closeFlush =
      api && new CloseFlush({api, flush: () => this.flushBeforeClose()});
  }

  get editor(): SongEditorStore | undefined {
    return this.editorStore;
  }

  get items(): ServiceItemStore | undefined {
    return this.itemStore;
  }

  /** Start from a workspace event, outside React render and its StrictMode probe. */
  startEditor(): void {
    if (this.api && !this.editorStore && !this.closing && !this.editorBlocked) {
      this.editorStore = new SongEditorStore(this.api, this.report);
      this.itemStore = new ServiceItemStore(
        this.api,
        this.editorStore,
        this.report,
      );
      if (typeof window !== 'undefined' && import.meta.env.DEV) {
        window.__llpSongEditorStore = this.editorStore;
      }
    }
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

  /** Release resources after unmount, including the close flush answer. */
  dispose(): Promise<void> {
    if (typeof window !== 'undefined' && import.meta.env.DEV) {
      delete window.__llpSongEditorStore;
    }
    this.closeFlush?.dispose();
    this.closing ??= Promise.resolve().then(() => {
      this.itemStore?.dispose();
      return this.editorStore?.dispose();
    });
    this.notices = [];
    this.listeners.clear();
    return this.closing;
  }

  // NOTE(0913vision): Unsent work lives in the editor's sessions and
  // operations, in the window's pending writes (item, 예배 순서, and
  // background edits), and in memo drafts that a refused save left waiting.
  // The close goes on only after main writes all accepted edits to disk.
  private async flushBeforeClose(): Promise<boolean> {
    // NOTE(0913vision): Commit-mode fields save on blur, before the write
    // gate stops.
    const focused = document.activeElement;
    if (focused instanceof HTMLElement) focused.blur();
    this.editorBlocked = true;
    const writes =
      this.api === undefined ? undefined : pendingWritesOf(this.api);
    let flushed = false;
    try {
      const [sent, editorFlushed, draftsSaved] = await Promise.all([
        writes?.flush() ?? Promise.resolve(true),
        this.editorStore?.flush() ?? Promise.resolve(true),
        this.itemStore?.flushDrafts() ?? Promise.resolve(true),
      ]);
      flushed =
        sent &&
        editorFlushed &&
        draftsSaved &&
        (await this.api?.app.savePending()) === true;
      return flushed;
    } finally {
      this.editorBlocked = flushed;
      if (!flushed) {
        writes?.resume();
        this.editorStore?.resume();
      }
    }
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
