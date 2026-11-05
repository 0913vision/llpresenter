export interface CutState {
  readonly auto: readonly number[];
  readonly user: readonly number[];
  readonly dismissed: boolean;
}

export const initialCutState = (auto: readonly number[]): CutState => ({
  auto: [...auto],
  user: [],
  dismissed: false,
});
export const effectiveCuts = (state: CutState): readonly number[] =>
  state.user.length > 0 ? state.user : state.dismissed ? [] : state.auto;
export const isShowingAuto = (state: CutState): boolean =>
  state.user.length === 0 && !state.dismissed && state.auto.length > 0;

export function toggleCutState(state: CutState, j: number): CutState {
  if (isShowingAuto(state) && state.auto.includes(j)) {
    return {
      ...state,
      dismissed: true,
      user: state.auto.filter(value => value !== j),
    };
  }
  const user = state.user.includes(j)
    ? state.user.filter(value => value !== j)
    : [...state.user, j].sort((a, b) => a - b);
  return {...state, user};
}

export interface EditHistory {
  readonly past: readonly CutState[];
  readonly present: CutState;
  readonly future: readonly CutState[];
}

export const EDIT_HISTORY_LIMIT = 1_000;

export const initialEditHistory = (auto: readonly number[]): EditHistory => ({
  past: [],
  present: initialCutState(auto),
  future: [],
});
export function pressGap(history: EditHistory, j: number): EditHistory {
  if (history.past.length >= EDIT_HISTORY_LIMIT) {
    throw new Error('Bible cut history limit exceeded');
  }
  return {
    past: [...history.past, history.present],
    present: toggleCutState(history.present, j),
    future: [],
  };
}

export function undoEdit(history: EditHistory): EditHistory {
  const previous = history.past.at(-1);
  return previous === undefined
    ? history
    : {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      };
}

export function redoEdit(history: EditHistory): EditHistory {
  const next = history.future[0];
  return next === undefined
    ? history
    : {
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      };
}

export const HINT_ALPHABET = 'asdfghjklqwertyuiopzxcvbnm1234567890';

export function hintLabels(count: number): readonly string[] {
  const letters = Array.from(HINT_ALPHABET);
  if (count <= letters.length) return letters.slice(0, count);
  const out: string[] = [];
  for (const first of letters) {
    for (const second of letters) {
      out.push(first + second);
      if (out.length === count) return out;
    }
  }
  return out;
}

export function hintCharFromEvent(event: {
  readonly code: string;
}): string | null {
  const letter = /^Key([A-Z])$/.exec(event.code)?.[1];
  if (letter !== undefined) return letter.toLowerCase();
  return /^Digit([0-9])$/.exec(event.code)?.[1] ?? null;
}
