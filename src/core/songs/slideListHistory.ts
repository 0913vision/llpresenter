import type {Result} from '../common/result';
import {emptySlideSelection} from './slideListSelection';
import {
  editSlideList,
  validateSlideList,
  type SlideListAdapter,
  type SlideListCommand,
  type SlideListError,
  type SlideListItem,
  type SlideListSnapshot,
} from './slideListEdits';

export const SLIDE_LIST_HISTORY_LIMIT = 100;
export interface SlideListHistory<T extends SlideListItem, Context = unknown> {
  readonly present: SlideListSnapshot<T, Context>;
  readonly past: ReadonlyArray<SlideListSnapshot<T, Context>>;
  readonly future: ReadonlyArray<SlideListSnapshot<T, Context>>;
}

/** Loading another revision resets history so undo cannot overwrite it. */
export function createSlideListHistory<
  T extends SlideListItem,
  Context = unknown,
>(
  slides: readonly T[],
  adapter: SlideListAdapter<T>,
  context?: Context,
): Result<SlideListHistory<T, Context>, SlideListError> {
  const result = validateSlideList(slides, adapter);
  return result.ok
    ? {
        ok: true,
        value: {
          present: {
            slides: structuredClone(result.value),
            selection: emptySlideSelection(),
            ...(context === undefined ? {} : {context}),
          },
          past: [],
          future: [],
        },
      }
    : result;
}

export function applySlideListCommand<
  T extends SlideListItem,
  Context = unknown,
>(
  history: SlideListHistory<T, Context>,
  command: SlideListCommand<T>,
  adapter: SlideListAdapter<T>,
): Result<SlideListHistory<T, Context>, SlideListError> {
  const result = editSlideList(history.present, command, adapter);
  if (!result.ok) return result;
  return recordSlideListSnapshot(history, result.value, {adapter});
}

/** Text edits share structural history; a continuing typing group replaces its present. */
export function recordSlideListSnapshot<
  T extends SlideListItem,
  Context = unknown,
>(
  history: SlideListHistory<T, Context>,
  snapshot: SlideListSnapshot<T, Context>,
  options: {readonly adapter: SlideListAdapter<T>; readonly coalesce?: boolean},
): Result<SlideListHistory<T, Context>, SlideListError> {
  if (snapshot === history.present) return {ok: true, value: history};
  const checked = validateSlideList(snapshot.slides, options.adapter);
  if (!checked.ok) return checked;
  return {
    ok: true,
    value: {
      present: snapshot,
      past:
        options.coalesce && history.past.length > 0
          ? history.past
          : [...history.past, history.present].slice(-SLIDE_LIST_HISTORY_LIMIT),
      future: [],
    },
  };
}

export function undoSlideList<T extends SlideListItem, Context = unknown>(
  history: SlideListHistory<T, Context>,
): SlideListHistory<T, Context> {
  const present = history.past.at(-1);
  return present === undefined
    ? history
    : {
        present,
        past: history.past.slice(0, -1),
        future: [...history.future, history.present],
      };
}

export function redoSlideList<T extends SlideListItem, Context = unknown>(
  history: SlideListHistory<T, Context>,
): SlideListHistory<T, Context> {
  const present = history.future.at(-1);
  return present === undefined
    ? history
    : {
        present,
        past: [...history.past, history.present],
        future: history.future.slice(0, -1),
      };
}
