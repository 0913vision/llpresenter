import {createPortal} from 'react-dom';
import {type JSX, type ReactNode} from 'react';
import {useNumberJump} from './numberJump';
import styles from './DraftOverlay.module.css';

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
        <h2>{'\uC2AC\uB77C\uC774\uB4DC \uC774\uB3D9'}</h2>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        <span>
          <kbd>Enter</kbd> {'\uC774\uB3D9'}
        </span>
      </footer>
    </>
  );
}

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
