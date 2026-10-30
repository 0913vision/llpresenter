import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type JSX,
  type ReactNode,
} from 'react';
import type {Screen} from '@core/schema/screens';
import styles from './LookEditor.module.css';

const INITIAL_CARDS = 6;
const PREFETCH_MARGIN = '400px';
const LAYERS = [0, 1, 2, 3, 4];
type Listener = (visible: boolean) => void;
type Register = (element: Element, listener: Listener) => () => void;

function Slot({
  screen,
  index,
  register,
  render,
}: {
  readonly screen: Screen;
  readonly index: number;
  readonly register: Register;
  readonly render: (screen: Screen) => ReactNode;
}): JSX.Element {
  const root = useRef<HTMLDivElement>(null);
  const requested = useRef(false);
  const backwards = useRef(false);
  const [visible, setVisible] = useState(
    () => typeof IntersectionObserver === 'undefined' || index < INITIAL_CARDS,
  );
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (root.current === null) return undefined;
    return register(root.current, setVisible);
  }, [register]);
  useLayoutEffect(() => {
    if (!requested.current || !focused || root.current === null) return;
    const controls = root.current.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    );
    const control = controls[backwards.current ? controls.length - 1 : 0];
    if (control !== undefined) {
      requested.current = false;
      control.focus();
    }
  }, [focused]);
  const leave = (event: FocusEvent<HTMLDivElement>): void => {
    if (
      !(event.relatedTarget instanceof Node) ||
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setFocused(false);
    }
  };
  return (
    <div
      ref={root}
      className={styles.cardSlot}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={leave}
      data-look-card-slot={screen.id}
    >
      {visible || focused ? (
        render(screen)
      ) : (
        <>
          <div className={styles.card} aria-hidden="true">
            <div className={styles.cardHeader}>
              <span>{'\u00a0'}</span>
            </div>
            <div className={styles.target}>{'\u00a0'}</div>
            <div className={styles.preview} />
            {LAYERS.map(layer => (
              <div key={layer} className={styles.layer} />
            ))}
          </div>
          <button
            type="button"
            className={styles.cardSentinel}
            aria-label={`${screen.name} 설정 열기`}
            onFocus={event => {
              requested.current = true;
              backwards.current =
                event.relatedTarget instanceof Node &&
                (event.currentTarget.compareDocumentPosition(
                  event.relatedTarget,
                ) &
                  Node.DOCUMENT_POSITION_FOLLOWING) !==
                  0;
              setFocused(true);
            }}
          />
        </>
      )}
    </div>
  );
}

/** Mounts full screen controls only near the viewport, with one shared observer. */
export function LookCardSlots({
  screens,
  render,
}: {
  readonly screens: readonly Screen[];
  readonly render: (screen: Screen) => ReactNode;
}): JSX.Element {
  const listeners = useRef(new Map<Element, Listener>());
  const observer = useRef<IntersectionObserver | null>(null);
  const container = useRef<HTMLDivElement>(null);
  const register = useCallback<Register>((element, listener) => {
    listeners.current.set(element, listener);
    observer.current?.observe(element);
    return () => {
      observer.current?.unobserve(element);
      listeners.current.delete(element);
    };
  }, []);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const next = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          listeners.current.get(entry.target)?.(entry.isIntersecting);
        }
      },
      {
        root: container.current?.parentElement ?? null,
        rootMargin: PREFETCH_MARGIN,
      },
    );
    observer.current = next;
    for (const element of listeners.current.keys()) next.observe(element);
    return () => {
      observer.current = null;
      next.disconnect();
    };
  }, []);
  return (
    <div ref={container} className={styles.cards}>
      {screens.map((screen, index) => (
        <Slot
          key={screen.id}
          screen={screen}
          index={index}
          register={register}
          render={render}
        />
      ))}
    </div>
  );
}
