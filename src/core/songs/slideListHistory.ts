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
export interface SlideListHistory<T extends SlideListItem> {
  readonly present: SlideListSnapshot<T>;
  readonly past: ReadonlyArray<SlideListSnapshot<T>>;
  readonly future: ReadonlyArray<SlideListSnapshot<T>>;
}

/** Loading another revision resets history so undo cannot overwrite it. */
export function createSlideListHistory<T extends SlideListItem>(
  slides: readonly T[],
  adapter: SlideListAdapter<T>,
): Result<SlideListHistory<T>, SlideListError> {
  const result = validateSlideList(slides, adapter);
  return result.ok
    ? {
        ok: true,
        value: {
          present: {
            slides: structuredClone(result.value),
            selection: emptySlideSelection(),
          },
          past: [],
          future: [],
        },
      }
    : result;
}

export function applySlideListCommand<T extends SlideListItem>(
  history: SlideListHistory<T>,
  command: SlideListCommand<T>,
  adapter: SlideListAdapter<T>,
): Result<SlideListHistory<T>, SlideListError> {
  const result = editSlideList(history.present, command, adapter);
  if (!result.ok) return result;
  if (result.value === history.present) return {ok: true, value: history};
  return {
    ok: true,
    value: {
      present: result.value,
      past: [...history.past, history.present].slice(-SLIDE_LIST_HISTORY_LIMIT),
      future: [],
    },
  };
}

export function undoSlideList<T extends SlideListItem>(
  history: SlideListHistory<T>,
): SlideListHistory<T> {
  const present = history.past.at(-1);
  return present === undefined
    ? history
    : {
        present,
        past: history.past.slice(0, -1),
        future: [...history.future, history.present],
      };
}

export function redoSlideList<T extends SlideListItem>(
  history: SlideListHistory<T>,
): SlideListHistory<T> {
  const present = history.future.at(-1);
  return present === undefined
    ? history
    : {
        present,
        past: [...history.past, history.present],
        future: history.future.slice(0, -1),
      };
}
