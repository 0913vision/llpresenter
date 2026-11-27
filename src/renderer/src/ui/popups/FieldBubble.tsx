import {useState, type JSX} from 'react';
import {createPortal} from 'react-dom';
import {placeFloating} from './floating';
import {layerContainer} from './layers';
import {modalStack} from './modalStack';
import {placeTooltip, viewportSize} from './placement';
import bubbleStyles from './FieldBubble.module.css';
import styles from './Tooltip.module.css';

/**
 * The reason a field refuses what it holds, in a bubble under the field at
 * once and for as long as the field has focus, where a tooltip would wait for
 * the pointer and close at the next key (USER Nov 27).
 */
export function FieldBubble({
  target,
  text,
}: {
  readonly target: HTMLElement | null;
  /** The reason; nothing shows when it is `undefined`. */
  readonly text: string | undefined;
}): JSX.Element | null {
  if (target === null || text === undefined) return null;
  return createPortal(
    <BubbleSurface target={target} text={text} />,
    layerContainer('tooltip'),
  );
}

function BubbleSurface({
  target,
  text,
}: {
  readonly target: HTMLElement;
  readonly text: string;
}): JSX.Element {
  const [overModal] = useState(() => modalStack.isOpen);
  // NOTE(0913vision): A new function each render places the bubble again as
  // the field widens with what is typed.
  const place = (element: HTMLElement | null): void => {
    if (element === null) return;
    placeFloating(element, size =>
      placeTooltip(target.getBoundingClientRect(), size, viewportSize()),
    );
  };
  return (
    <div
      ref={place}
      aria-hidden
      className={`${styles.tooltip} ${bubbleStyles.bubble}`}
      data-field-bubble=""
      data-over-modal={overModal ? '' : undefined}
    >
      {text}
    </div>
  );
}
