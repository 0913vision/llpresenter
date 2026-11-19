import {useCallback, useRef, useState, type JSX, type ReactNode} from 'react';
import {PictureReadiness} from './PictureReadiness';
import styles from './AtomicPictureContent.module.css';

/** Keeps the last interactive view visible while its replacement draws. */
export function AtomicPictureContent({
  identity,
  pending,
  content,
  initial = null,
  waitForPicture = false,
  pictureCount = 1,
  aside = null,
  initialReady = false,
}: {
  readonly identity: string;
  readonly pending: boolean;
  readonly content: JSX.Element;
  readonly initial?: JSX.Element | null;
  readonly waitForPicture?: boolean;
  readonly pictureCount?: number;
  /** Rendered beside the content, outside what is held and staged. */
  readonly aside?: ReactNode;
  /** The initial content was already prepared by an enclosing frame. */
  readonly initialReady?: boolean;
}): JSX.Element {
  const [displayed, setDisplayed] = useState<string | null>(
    initialReady ? identity : null,
  );
  const [held, setHeld] = useState<JSX.Element | null>(initial);
  const staging = !pending && displayed !== identity;
  const [choice, setChoice] = useState({identity, staging, version: 0});
  if (choice.identity !== identity || choice.staging !== staging) {
    setChoice({identity, staging, version: choice.version + 1});
  }
  const readySources = useRef({
    version: choice.version,
    sources: new Set<object>(),
  });
  if (!pending && displayed === identity && held !== content) setHeld(content);
  const reveal = useCallback(
    (source: object) => {
      if (readySources.current.version !== choice.version) {
        readySources.current = {version: choice.version, sources: new Set()};
      }
      readySources.current.sources.add(source);
      if (readySources.current.sources.size < pictureCount) return;
      setHeld(content);
      setDisplayed(identity);
    },
    [content, identity, pictureCount, choice.version],
  );
  if (staging && !waitForPicture) {
    setHeld(content);
    setDisplayed(identity);
  }
  const current = displayed === identity && !pending ? content : held;
  return (
    <div
      className={styles.root}
      data-picture-staging={pending || staging ? '' : undefined}
    >
      {current === null ? null : (
        <div key={displayed} className={styles.slot} inert={pending || staging}>
          <PictureReadiness.Provider value={null}>
            {current}
          </PictureReadiness.Provider>
        </div>
      )}
      {staging ? (
        <div
          key={identity}
          className={
            current === null
              ? `${styles.staged} ${styles.initial}`
              : styles.staged
          }
          inert
          aria-hidden="true"
        >
          <PictureReadiness.Provider value={reveal}>
            {content}
          </PictureReadiness.Provider>
        </div>
      ) : null}
      {aside}
    </div>
  );
}
