import {useShortcutText} from './commandBindings';
import {
  cloneElement,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type FocusEvent,
  type JSX,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react';
import {createPortal} from 'react-dom';
import {placeFloating} from './floating';
import {layerContainer} from './layers';
import {modalStack} from './modalStack';
import {placeTooltip, viewportSize} from './placement';
import {tooltipController} from './tooltipController';
import styles from './Tooltip.module.css';

/** What a tooltip says: a name or reason, a shortcut, and a second line. */
export interface TooltipContent {
  /** The name of what a click does, or the reason for a problem. */
  readonly text: string;
  /** A text shortcut, such as `F2` or `Ctrl Z`. */
  readonly shortcut?: string | undefined;
  readonly command?: string | undefined;
  /** One more fact, on a second line in `text-3`. */
  readonly sub?: string | undefined;
}

/** The props a tooltip target spreads, merged with its own handlers. */
export interface TooltipTargetProps {
  readonly onPointerEnter: (event: PointerEvent<HTMLElement>) => void;
  readonly onPointerLeave: (event: PointerEvent<HTMLElement>) => void;
  readonly onFocus: (event: FocusEvent<HTMLElement>) => void;
  readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-keyshortcuts'?: string | undefined;
}

export interface TooltipHook {
  readonly targetProps: TooltipTargetProps;
  /** The tooltip to render next to the target; `null` while it is hidden. */
  readonly tooltip: ReactNode;
}

/** Tooltip content for a plain `title` prop; `undefined` for no tooltip. */
export function titleTooltip(
  title: string | undefined,
): TooltipContent | undefined {
  return title === undefined ? undefined : {text: title};
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  Ctrl: 'Control',
  Esc: 'Escape',
  Del: 'Delete',
};

/** Converts a shown shortcut such as `Ctrl Z` to `aria-keyshortcuts` form. */
export function ariaShortcut(shortcut: string): string {
  return shortcut
    .split(' ')
    .filter(part => part !== '')
    .map(part => KEY_NAMES[part] ?? part)
    .join('+');
}

function isFocusVisible(element: HTMLElement): boolean {
  try {
    return element.matches(':focus-visible, :has(:focus-visible)');
  } catch {
    return false;
  }
}

function TooltipSurface({
  id,
  target,
  content,
}: {
  readonly id: string;
  readonly target: HTMLElement;
  readonly content: TooltipContent;
}): JSX.Element {
  const [overModal] = useState(() => modalStack.isOpen);
  const place = (element: HTMLElement | null): void => {
    if (element === null) return;
    placeFloating(element, size =>
      placeTooltip(target.getBoundingClientRect(), size, viewportSize()),
    );
  };

  return (
    <div
      ref={place}
      id={id}
      role="tooltip"
      className={styles.tooltip}
      data-over-modal={overModal ? '' : undefined}
    >
      {content.text}
      {content.shortcut === undefined ? null : (
        <span className={styles.key}>{content.shortcut}</span>
      )}
      {content.sub === undefined ? null : (
        <span className={styles.sub}>{content.sub}</span>
      )}
    </div>
  );
}

/**
 * Shows a tooltip for the element that spreads `targetProps`: 600ms after the
 * pointer rests on it or keyboard focus enters it, at once when another
 * tooltip just showed. Pass `undefined` for no tooltip.
 */
export function useTooltip(input: TooltipContent | undefined): TooltipHook {
  const shortcut = useShortcutText(input?.command);
  const content = input?.command === undefined ? input : {...input, shortcut};
  const owner = useId();
  const tooltipId = `${owner}-tooltip`;
  const shown = useSyncExternalStore(tooltipController.subscribe, () => {
    const current = tooltipController.current();
    return current?.owner === owner ? current : null;
  });
  const hasContent = content !== undefined;
  const isShown = shown !== null && hasContent;

  useEffect(() => () => tooltipController.release(owner), [owner]);
  useEffect(() => {
    if (!hasContent) tooltipController.release(owner);
  }, [hasContent, owner]);

  const show = (target: HTMLElement): void => {
    if (content === undefined) return;
    tooltipController.request({owner, target});
  };
  const hide = (): void => tooltipController.release(owner);

  const targetProps: TooltipTargetProps = {
    onPointerEnter: event => {
      if (event.pointerType !== 'touch') show(event.currentTarget);
    },
    onPointerLeave: hide,
    onFocus: event => {
      if (isFocusVisible(event.currentTarget)) show(event.currentTarget);
    },
    onBlur: hide,
    'aria-describedby': isShown ? tooltipId : undefined,
    'aria-keyshortcuts':
      content?.shortcut === undefined
        ? undefined
        : ariaShortcut(content.shortcut),
  };

  const tooltip =
    shown !== null && content !== undefined
      ? createPortal(
          <TooltipSurface
            id={tooltipId}
            target={shown.target}
            content={content}
          />,
          layerContainer('tooltip'),
        )
      : null;

  return {targetProps, tooltip};
}

type Handler<E> = ((event: E) => void) | undefined;

function both<E>(first: Handler<E>, second: Handler<E>): Handler<E> {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return event => {
    first(event);
    second(event);
  };
}

function joinSpaced(
  first: string | undefined,
  second: string | undefined,
): string | undefined {
  if (first === undefined) return second;
  if (second === undefined) return first;
  return `${first} ${second}`;
}

/** The handlers and ARIA props a target already has, before the tooltip's. */
export interface TooltipOwnProps<T extends HTMLElement> {
  readonly onPointerEnter?: ((event: PointerEvent<T>) => void) | undefined;
  readonly onPointerLeave?: ((event: PointerEvent<T>) => void) | undefined;
  readonly onFocus?: ((event: FocusEvent<T>) => void) | undefined;
  readonly onBlur?: ((event: FocusEvent<T>) => void) | undefined;
  readonly 'aria-describedby'?: string | undefined;
  readonly 'aria-keyshortcuts'?: string | undefined;
}

/**
 * Merges a target's own handlers with the tooltip's, calling the target's
 * first, and joins the `aria-describedby` ids.
 */
export function withTooltipProps<T extends HTMLElement>(
  own: TooltipOwnProps<T>,
  tooltip: TooltipTargetProps,
): Required<TooltipOwnProps<T>> & {
  readonly 'aria-keyshortcuts': string | undefined;
} {
  return {
    onPointerEnter: both(own.onPointerEnter, tooltip.onPointerEnter),
    onPointerLeave: both(own.onPointerLeave, tooltip.onPointerLeave),
    onFocus: both(own.onFocus, tooltip.onFocus),
    onBlur: both(own.onBlur, tooltip.onBlur),
    'aria-describedby': joinSpaced(
      own['aria-describedby'],
      tooltip['aria-describedby'],
    ),
    'aria-keyshortcuts': joinSpaced(
      own['aria-keyshortcuts'],
      tooltip['aria-keyshortcuts'],
    ),
  };
}

export interface TooltipProps extends TooltipContent {
  /** One element that takes the tooltip; it must pass the props to the DOM. */
  readonly children: ReactElement<TooltipOwnProps<HTMLElement>>;
}

/** Gives one element a tooltip, for targets that have no `title` prop. */
export function Tooltip({
  children,
  text,
  shortcut,
  sub,
}: TooltipProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text, shortcut, sub});
  return (
    <>
      {cloneElement(children, withTooltipProps(children.props, targetProps))}
      {tooltip}
    </>
  );
}
