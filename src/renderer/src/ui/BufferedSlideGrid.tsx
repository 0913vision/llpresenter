import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';

const NEAR_MARGIN = 200;

function scrollParent(node: HTMLElement | null): HTMLElement | null {
  let parent = node?.parentElement ?? null;
  while (parent !== null) {
    if (/auto|scroll/.test(getComputedStyle(parent).overflowY)) return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** Keeps the previous grid mounted while an incoming grid prepares. */
export function BufferedSlideGrid({
  itemKey,
  ready,
  children,
  onReveal,
}: {
  readonly itemKey: string;
  readonly ready: boolean;
  readonly children: ReactNode;
  readonly onReveal?: ((key: string) => void) | undefined;
}): JSX.Element {
  const [visible, setVisible] = useState(itemKey);
  const [old, setOld] = useState(() => children);
  const stage = useRef<HTMLDivElement>(null);
  const restoreFocus = useRef(false);
  if (visible === itemKey && old !== children) setOld(children);
  useLayoutEffect(() => {
    if (!restoreFocus.current || visible !== itemKey) return;
    restoreFocus.current = false;
    stage.current
      ?.querySelector<HTMLElement>('[role="listbox"]')
      ?.focus({preventScroll: true});
  }, [visible, itemKey]);
  useLayoutEffect(() => {
    if (visible === itemKey) {
      onReveal?.(itemKey);
      return;
    }
    let frame = 0;
    const start = performance.now();
    // NOTE(0913vision): A picture counts as near the way the picture itself
    // decides to draw: within the margin of its scroll viewport. A picture
    // further down waits for scrolling and is not waited for here, so the grid
    // shows as soon as what is in and next to the view is drawn.
    const viewport = scrollParent(stage.current);
    const check = (): void => {
      const node = stage.current;
      const clip = viewport?.getBoundingClientRect();
      const pending = [
        ...(node?.querySelectorAll<HTMLElement>(
          '[data-preview-ready="false"], [data-preview-ready="deferred"]',
        ) ?? []),
      ].some(picture => {
        const rect = picture.getBoundingClientRect();
        const top = clip?.top ?? 0;
        const bottom = clip?.bottom ?? window.innerHeight;
        return (
          rect.bottom >= top - NEAR_MARGIN && rect.top <= bottom + NEAR_MARGIN
        );
      });
      const images = node?.querySelectorAll('img') ?? [];
      const complete = [...images].every(image => image.complete);
      if (
        (ready && !pending && complete) ||
        performance.now() - start >= OUTPUT_REVEAL_DEADLINE_MS
      ) {
        restoreFocus.current =
          stage.current?.previousElementSibling?.contains(
            document.activeElement,
          ) ?? false;
        setVisible(itemKey);
        onReveal?.(itemKey);
      } else {
        frame = requestAnimationFrame(check);
      }
    };
    frame = requestAnimationFrame(check);
    return () => cancelAnimationFrame(frame);
  }, [itemKey, ready, visible, onReveal]);
  const pending = visible !== itemKey;
  return (
    <>
      {pending ? <div key={visible}>{old}</div> : null}
      <div
        key={itemKey}
        ref={stage}
        aria-hidden={pending ? true : undefined}
        inert={pending}
        data-picture-staging={pending ? '' : undefined}
        style={
          pending
            ? {
                position: 'absolute',
                inset: 0,
                // NOTE(0913vision): Opacity as well as visibility, so nothing
                // inside the incoming grid shows before it is complete.
                opacity: 0,
                visibility: 'hidden',
                pointerEvents: 'none',
              }
            : undefined
        }
      >
        {children}
      </div>
    </>
  );
}
