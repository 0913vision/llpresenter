import {createPortal} from 'react-dom';
import {useRef, type JSX, type ReactNode} from 'react';
import {useModal} from '@renderer/ui/useModal';
import {useNumberJump} from './numberJump';
import styles from './DraftOverlay.module.css';

export function DraftOverlay({
  kind,
  children,
  onClose,
}: {
  readonly kind: 'bible' | 'number';
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
      {kind === 'bible' ? (
        <BibleDialog onClose={onClose}>{children}</BibleDialog>
      ) : (
        <section className={styles.panel} data-kind="number" role="status">
          <OverlayContents kind="number">{children}</OverlayContents>
        </section>
      )}
    </div>,
    document.body,
  );
}

function BibleDialog({
  children,
  onClose,
}: {
  readonly children: ReactNode;
  readonly onClose: () => void;
}): JSX.Element {
  const surface = useRef<HTMLElement>(null);
  const keys = useModal({
    surface,
    onEscape: onClose,
    onEnter: undefined,
    initialFocus: 'text-field',
  });
  return (
    <section
      ref={surface}
      className={styles.panel}
      data-kind="bible"
      role="dialog"
      aria-label="성경 구절"
      aria-modal="true"
      onKeyDown={keys}
    >
      <OverlayContents kind="bible">{children}</OverlayContents>
    </section>
  );
}
function OverlayContents({
  kind,
  children,
}: {
  readonly kind: 'bible' | 'number';
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <>
      <header className={styles.heading}>
        <h2>{kind === 'bible' ? '성경 구절' : '슬라이드 이동'}</h2>
      </header>
      <div className={styles.content}>{children}</div>
      <footer className={styles.footer}>
        <span>
          <kbd>Enter</kbd> {kind === 'bible' ? '바로 띄우기' : '이동'}
        </span>
        {kind === 'bible' ? (
          <span>
            <kbd>Tab</kbd> {'다음 칸'}
          </span>
        ) : null}
      </footer>
    </>
  );
}

export function NumberJumpOverlay(): JSX.Element | null {
  const value = useNumberJump(state => state.value);
  if (value === '') return null;
  return (
    <DraftOverlay
      kind="number"
      onClose={() => useNumberJump.setState({value: ''})}
    >
      <div className={styles.number}>
        <span>슬라이드</span>
        <strong>{value}</strong>
        <span className={styles.cursor} />
      </div>
    </DraftOverlay>
  );
}
