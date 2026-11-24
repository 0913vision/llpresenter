import {createPortal} from 'react-dom';
import {type JSX, type ReactNode} from 'react';
import {useNumberJump} from './numberJump';
import styles from './DraftOverlay.module.css';

/**
 * A box over the window that shows what is being typed, closed by `onClose`.
 */
export function DraftOverlay({
  children,
  onClose,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
}): JSX.Element {
  return createPortal(
    <div
      className={styles.backdrop}
      data-variant="c"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className={styles.panel} data-kind="number" role="status">
        <OverlayContents>{children}</OverlayContents>
      </section>
    </div>,
    document.body,
  );
}

function OverlayContents({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <>
      <header className={styles.heading}>
        <h2>{'슬라이드 이동'}</h2>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        <span>
          <kbd>Enter</kbd> {'이동'}
        </span>
      </footer>
    </>
  );
}

/**
 * The box that shows the slide number being typed; nothing while no digit is
 * typed.
 */
export function NumberJumpOverlay(): JSX.Element | null {
  const value = useNumberJump(state => state.value);
  if (value === '') return null;
  return (
    <DraftOverlay onClose={() => useNumberJump.setState({value: ''})}>
      <div className={styles.number}>
        <span>슬라이드</span>
        <strong>{value}</strong>
        <span className={styles.cursor} />
      </div>
    </DraftOverlay>
  );
}
