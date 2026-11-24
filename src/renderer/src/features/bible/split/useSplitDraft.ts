import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import {
  changedGap,
  effectiveCuts,
  hintLabels,
  initialEditHistory,
  planSlides,
  pressGap,
  redoEdit,
  undoEdit,
  type EditHistory,
  type SplitLayout,
  type VerseInput,
} from '@core/bible';

/** How many slides a row of the previews shows. */
export const RESULTS_PER_ROW = 3;
const RESULT_TOP_INSET = 12;

/**
 * Scrolls the previews to the row of the slide that the last cut changed,
 * once the slides of the new cuts are drawn.
 */
function useScrollToChange(plan: ReturnType<typeof planSlides>) {
  const previews = useRef<HTMLDivElement>(null);
  const changed = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const gap = changed.current;
    const area = previews.current;
    if (gap === undefined || area === null) return;
    changed.current = undefined;
    const part = plan.cuts.filter(cut => cut <= gap).length;
    const rowStart = Math.floor(part / RESULTS_PER_ROW) * RESULTS_PER_ROW;
    const target = area.children.item(rowStart);
    if (target instanceof HTMLElement) {
      area.scrollTop = Math.ceil(target.offsetTop - RESULT_TOP_INSET);
    }
  }, [plan]);
  return {
    previews,
    /** Notes the gap that the next drawn slides changed. */
    changedAt: (gap: number | undefined): void => {
      changed.current = gap;
    },
  };
}

/**
 * The cuts being made in one verse: their undo history, the hint letters
 * typed so far, and the slides they give.
 */
export function useSplitDraft({
  verse,
  cuts,
  layout,
  prefix,
  preparedPlan,
}: {
  readonly verse: VerseInput;
  readonly cuts: readonly number[];
  readonly layout: SplitLayout;
  readonly prefix: string;
  /** The slides already planned for the cuts the editor starts with. */
  readonly preparedPlan?: ReturnType<typeof planSlides> | undefined;
}) {
  const [history, setHistory] = useState(() => initialEditHistory(cuts));
  const [typed, setTyped] = useState('');
  const plan = useMemo(() => {
    const present = effectiveCuts(history.present);
    const prepared =
      present.length === preparedPlan?.cuts.length &&
      present.every((cut, i) => preparedPlan.cuts[i] === cut);
    return prepared
      ? preparedPlan
      : planSlides(verse.text, present, {...layout, prefix});
  }, [verse.text, history.present, layout, prefix, preparedPlan]);
  const {previews, changedAt} = useScrollToChange(plan);
  const labels = hintLabels(Math.max(0, plan.words.length - 1));

  const edit = (next: EditHistory, gap?: number): void => {
    if (next === history) return;
    changedAt(gap ?? changedGap(history, next));
    setHistory(next);
  };
  return {
    plan,
    labels,
    /** The hint letters typed so far. */
    typed,
    previews,
    /** Cuts the verse at a gap between words, or joins it there again. */
    cut: (gap: number): void => {
      setTyped('');
      edit(pressGap(history, gap), gap);
    },
    undo: (): void => edit(undoEdit(history)),
    redo: (): void => edit(redoEdit(history)),
    clearTyped: (): void => setTyped(''),
    /**
     * Adds a typed hint letter.
     *
     * @returns The gap that the letters now name, or null while they name
     *   none yet.
     */
    typeHint: (letter: string): number | null => {
      const next = typed + letter;
      const index = labels.indexOf(next);
      if (index >= 0) return index + 1;
      setTyped(labels.some(label => label.startsWith(next)) ? next : '');
      return null;
    },
  };
}

/**
 * What useSplitDraft returns: the plan, the hint labels and typed letters, the
 * previews, and the calls to cut, undo and redo.
 */
export type SplitDraft = ReturnType<typeof useSplitDraft>;
