import {createPortal} from 'react-dom';
import {type JSX} from 'react';
import {useNumberJump} from './numberJump';
import styles from './NumberJumpOverlay.module.css';

/**
 * The box over the window that shows the slide number being typed; nothing
 * while no digit is typed. A click beside the box drops the number.
 */
export function NumberJumpOverlay(): JSX.Element | null {
  const value = useNumberJump(state => state.value);
  if (value === '') return null;
  return createPortal(
    <div
      className={styles.backdrop}
      data-variant="c"
      onMouseDown={event => {
        if (event.target === event.currentTarget) {
          useNumberJump.setState({value: ''});
        }
      }}
    >
      <section className={styles.panel} data-kind="number" role="status">
        <header className={styles.heading}>
          <h2>{'슬라이드 이동'}</h2>
        </header>
        <div className={styles.content}>
          <div className={styles.number}>
            <span>슬라이드</span>
            <strong>{value}</strong>
            <span className={styles.cursor} />
          </div>
        </div>
        <footer className={styles.footer}>
          <span>
            <kbd>Enter</kbd> {'이동'}
          </span>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
