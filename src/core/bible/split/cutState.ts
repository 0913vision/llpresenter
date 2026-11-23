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

interface EditStep {
  readonly gap: number;
  readonly dismissedAuto: boolean;
}

/** Retains recent undo steps without limiting how many gaps can be edited. */
export const EDIT_HISTORY_LIMIT = 2_048;

export interface EditHistory {
  readonly past: readonly EditStep[];
  readonly present: CutState;
  readonly future: readonly EditStep[];
}

export const initialEditHistory = (auto: readonly number[]): EditHistory => ({
  past: [],
  present: initialCutState(auto),
  future: [],
});
export function pressGap(history: EditHistory, j: number): EditHistory {
  return {
    past: [
      ...history.past.slice(-(EDIT_HISTORY_LIMIT - 1)),
      {
        gap: j,
        dismissedAuto:
          isShowingAuto(history.present) && history.present.auto.includes(j),
      },
    ],
    present: toggleCutState(history.present, j),
    future: [],
  };
}

export function undoEdit(history: EditHistory): EditHistory {
  const step = history.past.at(-1);
  if (step === undefined) return history;
  const state = history.present;
  const user = state.user.includes(step.gap)
    ? state.user.filter(gap => gap !== step.gap)
    : [...state.user, step.gap].sort((a, b) => a - b);
  return {
    past: history.past.slice(0, -1),
    present: step.dismissedAuto
      ? {...state, user: [], dismissed: false}
      : {...state, user},
    future: [step, ...history.future],
  };
}

export function redoEdit(history: EditHistory): EditHistory {
  const step = history.future[0];
  return step === undefined
    ? history
    : {
        past: [...history.past, step],
        present: toggleCutState(history.present, step.gap),
        future: history.future.slice(1),
      };
}

/**
 * The gap an edit from `history` to `next` changed, for the view to bring
 * into sight: the gap the operator pressed, or else the first cut that came
 * or went. Showing or dropping the automatic cuts names the cut that moved.
 */
export function changedGap(
  history: EditHistory,
  next: EditHistory,
): number | undefined {
  const before = history.present;
  const after = next.present;
  const previous = effectiveCuts(before);
  const cuts = effectiveCuts(after);
  const userGap = [...before.user, ...after.user].find(
    value => before.user.includes(value) !== after.user.includes(value),
  );
  const effectiveGap = [...previous, ...cuts].find(
    value => previous.includes(value) !== cuts.includes(value),
  );
  return before.dismissed !== after.dismissed
    ? effectiveGap
    : (userGap ?? effectiveGap);
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
