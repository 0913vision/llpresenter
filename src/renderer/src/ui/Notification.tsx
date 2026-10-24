import {
  Fragment,
  useEffect,
  useEffectEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
} from 'react';
import {createPortal} from 'react-dom';
import {Button} from './Button';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {IconButton} from './IconButton';
import {layerContainer} from './layers';
import type {Notice} from './notices';
import styles from './Notification.module.css';

/** How long an information card shows once nothing holds it. */
export const NOTICE_LIFETIME_MS = 6000;

const CARD_ICON_SIZE = 18;
const META_ARROW_SIZE = 12;
const CLOSE_LABEL = '알림 닫기';
const META_ARROW_LABEL = '에서';
const WARNING = '[data-state="warning"]';

function useHeld(): {
  readonly held: boolean;
  readonly holdProps: {
    readonly onPointerEnter: () => void;
    readonly onPointerLeave: () => void;
    readonly onFocus: () => void;
    readonly onBlur: (event: FocusEvent<HTMLElement>) => void;
  };
} {
  const [pointerInside, setPointerInside] = useState(false);
  const [focusInside, setFocusInside] = useState(false);
  return {
    held: pointerInside || focusInside,
    holdProps: {
      onPointerEnter: () => setPointerInside(true),
      onPointerLeave: () => setPointerInside(false),
      onFocus: () => setFocusInside(true),
      onBlur: event => {
        const next = event.relatedTarget;
        if (!(next instanceof Node && event.currentTarget.contains(next))) {
          setFocusInside(false);
        }
      },
    },
  };
}

// NOTE(0913vision): The timer follows the notice object, so a notice that
// replaces a card with the same cause gets its full six seconds again.
function useLifetime(notice: Notice, held: boolean, close: () => void): void {
  const expire = useEffectEvent(close);
  useEffect(() => {
    if (notice.kind !== 'info' || held) return undefined;
    const timer = setTimeout(expire, NOTICE_LIFETIME_MS);
    return () => clearTimeout(timer);
  }, [notice, held]);
}

function Meta({values}: {readonly values: readonly string[]}): JSX.Element {
  return (
    <span className={styles.meta}>
      {values.map((value, index) => (
        <Fragment key={value}>
          {index === 0 ? null : (
            <span role="img" aria-label={META_ARROW_LABEL}>
              <Icon
                name="arrow"
                size={META_ARROW_SIZE}
                className={styles.arrow}
              />
            </span>
          )}
          <span>{value}</span>
        </Fragment>
      ))}
    </span>
  );
}

/**
 * One notification card. A warning stays until it is resolved or closed;
 * information closes after six seconds, counted again in full once the
 * pointer and focus leave it.
 */
export function NotificationCard({
  notice,
  onClose,
}: {
  readonly notice: Notice;
  readonly onClose: (key: string) => void;
}): JSX.Element {
  const titleId = useId();
  const {held, holdProps} = useHeld();
  useLifetime(notice, held, () => onClose(notice.key));
  const warning = notice.kind === 'warning';
  return (
    <section
      {...holdProps}
      role={warning ? 'alert' : 'status'}
      aria-labelledby={titleId}
      data-state={warning ? 'warning' : undefined}
      className={styles.card}
    >
      <Icon name={notice.icon} size={CARD_ICON_SIZE} className={styles.icon} />
      <div className={styles.body}>
        <div className={styles.text}>
          <div className={styles.head}>
            <span id={titleId} className={styles.title}>
              {notice.title}
            </span>
            <span className={styles.time}>{notice.time}</span>
          </div>
          {notice.meta === undefined ? null : <Meta values={notice.meta} />}
        </div>
        {notice.actions === undefined ? null : (
          <div className={styles.actions}>
            {notice.actions.map(action => (
              <Button
                key={action.label}
                icon={action.icon}
                onClick={action.onSelect}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      <IconButton
        icon="x"
        label={CLOSE_LABEL}
        className={styles.close}
        onClick={() => onClose(notice.key)}
      />
    </section>
  );
}

function warningStackHeight(stack: HTMLElement): number {
  const last = [...stack.querySelectorAll<HTMLElement>(WARNING)].at(-1);
  if (last === undefined) return 0;
  return (
    last.getBoundingClientRect().bottom - stack.getBoundingClientRect().top
  );
}

function useWarningHeight(
  report: ((height: number) => void) | undefined,
): (stack: HTMLDivElement | null) => void {
  const [stack, setStack] = useState<HTMLDivElement | null>(null);
  const lastHeight = useRef(0);
  const measure = useEffectEvent(() => {
    if (stack === null || report === undefined) return;
    const height = warningStackHeight(stack);
    if (height === lastHeight.current) return;
    lastHeight.current = height;
    report(height);
  });
  useLayoutEffect(() => {
    measure();
  });
  useEffect(() => {
    if (stack === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(() => measure());
    observer.observe(stack);
    return () => observer.disconnect();
  }, [stack]);
  return setStack;
}

export interface NotificationStackProps {
  /**
   * The cards, newest first; build the list with `addNotice`. Keep each notice
   * object while its card shows: a new object starts its six seconds again.
   */
  readonly notices: readonly Notice[];
  /** The narrow window form: under the 40px toolbar, 360 wide. */
  readonly compact?: boolean | undefined;
  /** Closes a card: its close button, or the end of an information card. */
  readonly onClose: (key: string) => void;
  /**
   * Reports how far the lasting warning cards reach below the stack's top, so
   * the right column can move down by it plus 4px; 0 with no warning.
   */
  readonly onWarningHeightChange?: ((height: number) => void) | undefined;
}

/**
 * The notification cards over the right column (`ll-notice-stack`), in their
 * own layer above dialogs and the scrim. They never take focus.
 */
export function NotificationStack({
  notices,
  compact = false,
  onClose,
  onWarningHeightChange,
}: NotificationStackProps): JSX.Element {
  const stackRef = useWarningHeight(onWarningHeightChange);
  return createPortal(
    <div
      ref={stackRef}
      className={classNames(styles.stack, compact && styles.compact)}
    >
      {notices.map(notice => (
        <NotificationCard key={notice.key} notice={notice} onClose={onClose} />
      ))}
    </div>,
    layerContainer('notification'),
  );
}
