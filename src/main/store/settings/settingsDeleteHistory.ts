import type {
  SettingsDocument,
  SettingsName,
} from '@core/schema/app/settingsDocuments';

/** The most deletions one settings area keeps for 실행 취소. */
const MAX_DELETE_STEPS = 100;

/** One deletion: the documents it changed, before and after. */
export interface SettingsDeleteStep {
  readonly before: readonly SettingsDocument[];
  readonly after: readonly SettingsDocument[];
}

/** Which way a deletion is replayed: brought back, or deleted again. */
export type DeleteDirection = 'undo' | 'redo';

/**
 * The rows of each settings area whose removal is a deletion, by the field
 * that lists them.
 */
const DELETABLE_ROWS: Partial<Record<SettingsName, readonly string[]>> = {
  screens: ['screens'],
  themes: ['themes'],
  macros: ['macros', 'collections'],
  quick: ['items'],
  messages: ['templates'],
  props: ['props'],
  timers: ['timers'],
  labels: ['labels'],
};

/** A row's key: a label is known by its name, every other row by its id. */
function rowKey(row: unknown, key: 'id' | 'name'): string | undefined {
  if (row === null || typeof row !== 'object') return undefined;
  const value: unknown = Reflect.get(row, key);
  return typeof value === 'string' ? value : undefined;
}

/**
 * Whether a row of the field is gone after the update. A label rename keeps
 * the count, so only a shorter label list can have lost one.
 */
function rowsRemoved(
  before: SettingsDocument,
  after: SettingsDocument,
  field: string,
): boolean {
  const oldRows: unknown = Reflect.get(before.value, field);
  const newRows: unknown = Reflect.get(after.value, field);
  if (!Array.isArray(oldRows) || !Array.isArray(newRows)) return false;
  const checkedOld: readonly unknown[] = oldRows;
  const checkedNew: readonly unknown[] = newRows;
  const labels = before.name === 'labels';
  if (labels && checkedNew.length >= checkedOld.length) return false;
  const key = labels ? 'name' : 'id';
  const kept = new Set(checkedNew.map(row => rowKey(row, key)));
  return checkedOld.some(row => {
    const id = rowKey(row, key);
    return id !== undefined && !kept.has(id);
  });
}

/** Whether a macro that stays lost one of its actions. */
function macroLostActions(
  before: Extract<SettingsDocument, {name: 'macros'}>,
  after: Extract<SettingsDocument, {name: 'macros'}>,
): boolean {
  const current = new Map(after.value.macros.map(macro => [macro.id, macro]));
  return before.value.macros.some(macro => {
    const next = current.get(macro.id);
    return next !== undefined && next.actions.length < macro.actions.length;
  });
}

/**
 * Whether an update of a settings area deletes something in it: a screen,
 * theme, macro or one of its actions, quick item, message, prop, timer or
 * label. Such an update is a step of 실행 취소.
 */
export function removedSettingsObject(
  before: SettingsDocument,
  after: SettingsDocument,
): boolean {
  if (before.name !== after.name) return false;
  if (
    before.name === 'macros' &&
    after.name === 'macros' &&
    macroLostActions(before, after)
  ) {
    return true;
  }
  return (DELETABLE_ROWS[before.name] ?? []).some(field =>
    rowsRemoved(before, after, field),
  );
}

/** The deletions of each settings area that 실행 취소 and 다시 실행 replay. */
export class SettingsDeleteHistory {
  private readonly areas = new Map<
    SettingsName,
    {undo: SettingsDeleteStep[]; redo: SettingsDeleteStep[]}
  >();

  /** A new deletion: the latest to undo, and nothing left to redo. */
  record(name: SettingsName, step: SettingsDeleteStep): void {
    const history = this.areas.get(name) ?? {undo: [], redo: []};
    history.undo.push(step);
    if (history.undo.length > MAX_DELETE_STEPS) history.undo.shift();
    history.redo = [];
    this.areas.set(name, history);
  }

  /** The deletion that `direction` replays next, if any. */
  latest(
    name: SettingsName,
    direction: DeleteDirection,
  ): SettingsDeleteStep | undefined {
    return this.areas.get(name)?.[direction].at(-1);
  }

  /** The latest step was replayed: it moves to the other direction. */
  replayed(name: SettingsName, direction: DeleteDirection): void {
    const history = this.areas.get(name);
    const step = history?.[direction].pop();
    if (history === undefined || step === undefined) return;
    history[direction === 'undo' ? 'redo' : 'undo'].push(step);
  }
}
