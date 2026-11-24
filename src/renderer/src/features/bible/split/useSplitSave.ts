import {useEffect, useRef, useState, type RefObject} from 'react';
import type {planSlides} from '@core/bible';
import {useAlive} from '@renderer/ui/useAlive';

/**
 * How long 확정 waits after the AI's cuts came in, so an Enter pressed for the
 * spinner doesn't confirm cuts the operator hasn't seen.
 */
const CONFIRM_GUARD_MS = 400;

/** Shakes the previews of the slides that don't fit, to show why 확정 waits. */
function shakeOverflowing(previews: HTMLElement | null, shake: string): void {
  previews
    ?.querySelectorAll<HTMLElement>('figure[data-overflow="true"]')
    .forEach(preview => {
      preview.classList.remove(shake);
      preview.getBoundingClientRect();
      preview.classList.add(shake);
    });
}

/**
 * 확정 of the 절 나누기 dialog: it saves the cuts once, keeps the dialog locked
 * while it saves, and shows why a save failed.
 */
export function useSplitSave({
  plan,
  previews,
  shakeClass,
  afterSpinner,
  onConfirm,
}: {
  readonly plan: ReturnType<typeof planSlides>;
  readonly previews: RefObject<HTMLDivElement | null>;
  readonly shakeClass: string;
  /** The editor took the place of the spinner of the AI's cuts. */
  readonly afterSpinner: boolean;
  readonly onConfirm: (
    cuts: readonly number[],
    texts: readonly string[],
  ) => Promise<void>;
}) {
  const alive = useAlive();
  const guarded = useRef(afterSpinner);
  useEffect(() => {
    if (!afterSpinner) return;
    const timer = setTimeout(() => {
      guarded.current = false;
    }, CONFIRM_GUARD_MS);
    return () => clearTimeout(timer);
  }, [afterSpinner]);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const confirm = (): void => {
    if (locked.current || guarded.current) return;
    if (!plan.ok) {
      shakeOverflowing(previews.current, shakeClass);
      return;
    }
    locked.current = true;
    setBusy(true);
    setProblem(undefined);
    onConfirm(
      plan.cuts,
      plan.slides.map(slide => slide.text),
    )
      .catch((cause: unknown) => {
        if (alive.current) {
          setProblem(
            cause instanceof Error ? cause.message : '절 나누기 저장 실패',
          );
        }
      })
      .finally(() => {
        if (alive.current) {
          locked.current = false;
          setBusy(false);
        }
      });
  };
  return {
    confirm,
    busy,
    problem,
    clearProblem: (): void => setProblem(undefined),
    /** Whether a save runs, which nothing may change. */
    locked: (): boolean => locked.current,
  };
}

/**
 * What useSplitSave returns: 확정, whether a save runs, and the problem of a
 * failed save.
 */
export type SplitSave = ReturnType<typeof useSplitSave>;
