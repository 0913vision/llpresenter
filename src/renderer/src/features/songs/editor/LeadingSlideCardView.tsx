import {useLayoutEffect, useRef, type CSSProperties, type JSX} from 'react';
import type {LeadingSlideCard, SlideSurfaceMode} from './SlideCardRenderer';
import styles from './EditorSlidePlate.module.css';

/** The item-owned card uses the same virtual row or cell as the content slides. */
export function LeadingSlideCardView({
  card,
  mode,
  style,
  onHeight,
}: {
  readonly card: LeadingSlideCard;
  readonly mode: SlideSurfaceMode;
  readonly style: CSSProperties;
  readonly onHeight?: ((height: number) => void) | undefined;
}): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (node === null || onHeight === undefined) return;
    const measure = (): void => {
      const height = node.getBoundingClientRect().height;
      if (height > 0) onHeight(height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [onHeight]);
  return (
    <div
      ref={ref}
      className={styles.leading}
      style={style}
      data-leading-card
      tabIndex={-1}
      aria-label={card.label}
    >
      <span className={styles.leadingNumber}>1</span>
      {card.render(mode)}
    </div>
  );
}
