import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type JSX,
  type ReactNode,
} from 'react';
import {PictureReadiness} from './PictureReadiness';
import styles from './DrawAhead.module.css';

/** Pictures that start drawing in one idle moment. */
const PER_STEP = 2;
/** Gives up on pictures that do not finish. */
const ITEM_LIMIT_MS = 4000;

function idle(run: () => void): () => void {
  if (typeof requestIdleCallback === 'function') {
    const handle = requestIdleCallback(run, {timeout: 200});
    return () => cancelIdleCallback(handle);
  }
  const handle = setTimeout(run, 16);
  return () => clearTimeout(handle);
}

/**
 * Draws pictures out of sight a few at a time while the window is idle; their
 * finished views wait in the picture park for the tiles that show them next.
 */
export function DrawAhead({
  pictures,
  onDone,
}: {
  readonly pictures: readonly ReactNode[];
  readonly onDone: () => void;
}): JSX.Element {
  const [shown, setShown] = useState(0);
  const finished = useRef(new Set<object>());
  const ended = useRef(false);
  const latest = useRef(onDone);
  useLayoutEffect(() => {
    latest.current = onDone;
  });
  const end = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    latest.current();
  }, []);
  const ready = useCallback(
    (source: object) => {
      finished.current.add(source);
      if (finished.current.size >= pictures.length) end();
    },
    [pictures.length, end],
  );
  useEffect(() => {
    if (shown >= pictures.length) return undefined;
    return idle(() => setShown(count => count + PER_STEP));
  }, [shown, pictures.length]);
  useEffect(() => {
    if (pictures.length === 0) end();
    const limit = setTimeout(end, ITEM_LIMIT_MS);
    return () => clearTimeout(limit);
  }, [pictures.length, end]);
  return (
    <PictureReadiness.Provider value={ready}>
      {pictures.slice(0, shown).map((picture, index) => (
        <div key={index} className={styles.picture}>
          {picture}
        </div>
      ))}
    </PictureReadiness.Provider>
  );
}

/** The out-of-sight box that pictures drawn ahead live in. */
export function AheadBox({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={styles.ahead}
      aria-hidden="true"
      inert
      data-drawing-ahead=""
    >
      {children}
    </div>
  );
}
