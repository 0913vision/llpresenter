import type {LlpApi} from '@contracts/ipc/api';
import type {Notice} from '@renderer/ui/popups/notices';
import {undoFailure, undoTimeline, type UndoOwner} from './undoTimeline';
import type {SettingsName} from '@core/schema/app/settingsDocuments';

interface State {
  readonly undo: number;
  readonly redo: number;
  readonly busy: boolean;
}
class DeleteHistory implements UndoOwner {
  private readonly undo: number[] = [];
  private redo: number[] = [];
  private state: State = {undo: 0, redo: 0, busy: false};
  private readonly listeners = new Set<() => void>();
  constructor(
    private readonly api: Pick<LlpApi, 'settings'>,
    private readonly area: SettingsName,
  ) {}
  readonly get = (): State => this.state;
  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  private set(state: State): void {
    this.state = state;
    for (const listener of this.listeners) listener();
  }
  record(revision: number): void {
    this.undo.push(revision);
    this.redo = [];
    this.set({undo: this.undo.length, redo: 0, busy: this.state.busy});
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
    const expectedRevision = from.at(-1);
    if (this.state.busy || expectedRevision === undefined) return false;
    this.set({...this.state, busy: true});
    try {
      const result = await this.api.settings.edit({
        type: kind === 'undo' ? 'settings.undoDelete' : 'settings.redoDelete',
        name: 'delete-history',
        area: this.area,
        expectedRevision,
      });
      if (!result.ok && result.error.reason !== 'write-failed') return false;
      from.pop();
      to.push(expectedRevision);
      this.set({undo: this.undo.length, redo: this.redo.length, busy: false});
      return true;
    } finally {
      this.set({...this.state, busy: false});
    }
  }
}
const stores = new WeakMap<
  LlpApi['settings'],
  Map<SettingsName, DeleteHistory>
>();
/**
 * The undo history of deletes in one settings file, made once per app
 * connection and file.
 */
export function settingsDeleteHistory(
  api: Pick<LlpApi, 'settings'>,
  area: SettingsName,
): DeleteHistory {
  let areas = stores.get(api.settings);
  if (!areas) {
    areas = new Map();
    stores.set(api.settings, areas);
  }
  let store = areas.get(area);
  if (!store) {
    store = new DeleteHistory(api, area);
    areas.set(area, store);
  }
  return store;
}
