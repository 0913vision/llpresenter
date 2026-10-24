import type {JSX, PointerEvent} from 'react';
import {useTooltip} from './Tooltip';

/** Whether an element's text is cut off with an ellipsis. */
export function isTruncated(element: HTMLElement): boolean {
  return element.scrollWidth > element.clientWidth;
}

/**
 * One line of text that ends in an ellipsis when it doesn't fit, and shows
 * the full text in a tooltip only then.
 */
export function TruncatedText({
  text,
  className,
  id,
}: {
  readonly text: string;
  readonly className?: string | undefined;
  readonly id?: string | undefined;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text});
  const onPointerEnter = (event: PointerEvent<HTMLElement>): void => {
    if (isTruncated(event.currentTarget)) targetProps.onPointerEnter(event);
  };
  return (
    <span
      id={id}
      className={className}
      onPointerEnter={onPointerEnter}
      onPointerLeave={targetProps.onPointerLeave}
    >
      {text}
      {tooltip}
    </span>
  );
}
