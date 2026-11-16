import {
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {OUTPUT_REVEAL_DEADLINE_MS} from '@core/output/revealDeadline';

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
  if (visible === itemKey && old !== children) setOld(children);
  useLayoutEffect(() => {
    if (visible === itemKey) {
      onReveal?.(itemKey);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const check = (): void => {
      const node = stage.current;
      const pending = [
        ...(node?.querySelectorAll<HTMLElement>(
          '[data-preview-ready="false"], [data-preview-ready="deferred"]',
        ) ?? []),
      ].some(picture => {
        const rect = picture.getBoundingClientRect();
        return rect.bottom >= -200 && rect.top <= window.innerHeight + 200;
      });
      const images = node?.querySelectorAll('img') ?? [];
      const complete = [...images].every(image => image.complete);
      if (
        (ready && !pending && complete) ||
        performance.now() - start >= OUTPUT_REVEAL_DEADLINE_MS
      ) {
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
        style={
          pending
            ? {
                position: 'absolute',
                inset: 0,
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
