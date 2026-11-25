import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  undoFailure,
  undoTimeline,
  type UndoOwner,
  type UndoPlace,
} from './undoTimeline';
import {pushUndoStep} from '@core/common/undoHistory';

type Area = 'song' | 'service' | 'template';
interface Entry {
  readonly area: Area;
  readonly id: string;
}
interface State {
  readonly undo: number;
  readonly redo: number;
  readonly busy: boolean;
}

class ContentDeleteHistory implements UndoOwner {
  private readonly undo: Entry[] = [];
  private redo: Entry[] = [];
  private state: State = {undo: 0, redo: 0, busy: false};
  private readonly listeners = new Set<() => void>();
  constructor(private readonly content: LlpApi['content']) {}
  readonly get = (): State => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private publish(busy: boolean): void {
    this.state = {undo: this.undo.length, redo: this.redo.length, busy};
    for (const listener of this.listeners) listener();
  }
  record(area: Area, id: string): void {
    pushUndoStep(this.undo, {area, id});
    this.redo = [];
    this.publish(false);
    undoTimeline.record(this);
  }
  /**
   * Brings back one deleted song, 예배 or 템플릿 wherever it is in the history,
   * as the 되돌리기 of its notice does; false when it is no longer there or
   * main refused.
   */
  readonly restore = async (area: Area, id: string): Promise<boolean> => {
    const index = this.undo.findIndex(
      entry => entry.area === area && entry.id === id,
    );
    if (this.state.busy || index < 0) return false;
    this.publish(true);
    try {
      const result = await this.content.edit({
        type: 'content.undoDelete',
        area,
        id,
      });
      if (!result.ok && result.error.reason !== 'write-failed') return false;
      this.undo.splice(index, 1);
      undoTimeline.drop(this);
      return true;
    } finally {
      this.publish(false);
    }
  };

  private restored: Entry | undefined;
  readonly replay = async (
    kind: 'undo' | 'redo',
    report?: (notice: Notice) => void,
  ): Promise<boolean> => {
    const entry = (kind === 'undo' ? this.undo : this.redo).at(-1);
    const done = await this.run(kind);
    if (!done) report?.(undoFailure(kind, '삭제'));
    this.restored = done && kind === 'undo' ? entry : undefined;
    return done;
  };
  readonly place = (): UndoPlace | undefined =>
    this.restored?.area === 'song'
      ? {kind: 'song', songId: this.restored.id}
      : undefined;
  private async run(kind: 'undo' | 'redo'): Promise<boolean> {
    const from = kind === 'undo' ? this.undo : this.redo;
    const to = kind === 'undo' ? this.redo : this.undo;
    const entry = from.at(-1);
    if (this.state.busy || entry === undefined) return false;
    this.publish(true);
    try {
      const result = await this.content.edit({
        type: kind === 'undo' ? 'content.undoDelete' : 'content.redoDelete',
        ...entry,
      });
      if (!result.ok && result.error.reason !== 'write-failed') return false;
      from.pop();
      to.push(entry);
      return true;
    } finally {
      this.publish(false);
    }
  }
}
/**
 * Whose deletions a history keeps: the library's songs, deleted in the
 * 라이브러리 tab, or the 예배 and 템플릿 of the service list. Each is its own
 * history, as each tab runs back only its own steps (USER Nov 25).
 */
export type ContentDeleteGroup = 'songs' | 'services';

const histories = new WeakMap<
  LlpApi['content'],
  Map<ContentDeleteGroup, ContentDeleteHistory>
>();
/**
 * The undo history of deleted songs, or of deleted 예배 and 템플릿, for one app
 * connection, made once and shared.
 */
export function contentDeleteHistory(
  content: LlpApi['content'],
  group: ContentDeleteGroup,
): ContentDeleteHistory {
  let groups = histories.get(content);
  if (!groups) {
    groups = new Map();
    histories.set(content, groups);
  }
  let history = groups.get(group);
  if (!history) {
    history = new ContentDeleteHistory(content);
    groups.set(group, history);
  }
  return history;
}
