import type {LlpApi, Unsubscribe} from '@shared/ipc';
import {answerCloseFlush, SongEditorStore} from '@renderer/prep/editor';
import {ServiceItemStore} from '@renderer/prep/service/serviceItemStore';
import {addNotice, removeNotice, type Notice} from '@renderer/ui/notices';

/** Window-owned editor sessions and their shared notification destination. */
export class ControlSession {
  private editorStore: SongEditorStore | undefined;
  private itemStore: ServiceItemStore | undefined;
  private notices: readonly Notice[] = [];
  private readonly listeners = new Set<() => void>();
  private closing: Promise<void> | undefined;
  private editorBlocked = false;
  private readonly stopCloseFlush: Unsubscribe | undefined;

  constructor(readonly api: LlpApi | undefined) {
    this.stopCloseFlush =
      api &&
      answerCloseFlush({
        api,
        flush: () => this.flushBeforeClose(),
        report: this.report,
      });
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
    this.stopCloseFlush?.();
    this.closing ??= Promise.resolve().then(() => {
      this.itemStore?.dispose();
      return this.editorStore?.dispose();
    });
    this.notices = [];
    this.listeners.clear();
    return this.closing;
  }

  private async flushBeforeClose(): Promise<boolean> {
    this.editorBlocked = true;
    let flushed = false;
    try {
      const [, editorFlushed] = await Promise.all([
        this.itemStore?.flush(),
        this.editorStore?.flush(),
      ]);
      flushed = editorFlushed ?? true;
      return flushed;
    } finally {
      this.editorBlocked = flushed;
      if (!flushed) this.itemStore?.resume();
    }
  }

  private publish(): void {
    for (const listener of this.listeners) listener();
  }
}
