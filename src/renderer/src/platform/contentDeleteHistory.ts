import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/notices';
import {undoFailure, undoTimeline, type UndoOwner} from './undoTimeline';

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
    this.undo.push({area, id});
    this.redo = [];
    this.publish(false);
    undoTimeline.record(this);
  }
  readonly replay = async (
    kind: 'undo' | 'redo',
    report?: (notice: Notice) => void,
  ): Promise<boolean> => {
    const done = await this.run(kind);
    if (!done) report?.(undoFailure(kind, '삭제'));
    return done;
  };
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
const histories = new WeakMap<LlpApi['content'], ContentDeleteHistory>();
export function contentDeleteHistory(
  content: LlpApi['content'],
): ContentDeleteHistory {
  let history = histories.get(content);
  if (!history) {
    history = new ContentDeleteHistory(content);
    histories.set(content, history);
  }
  return history;
}
