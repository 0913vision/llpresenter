import {createPortal} from 'react-dom';
import type {JSX, ReactNode} from 'react';
import {useNumberJump} from './numberJump';
import styles from './DraftOverlay.module.css';

const choice: unknown = import.meta.env.VITE_LLP_DRAFT_OVERLAY;
export const draftOverlay = choice === 'a' || choice === 'b' ? choice : null;

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
      data-variant={draftOverlay ?? undefined}
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={styles.panel}
        data-kind={kind}
        role={kind === 'bible' ? 'dialog' : 'status'}
        aria-label={kind === 'bible' ? '성경 구절' : undefined}
        aria-modal={kind === 'bible' ? true : undefined}
      >
        <header className={styles.heading}>
          <div className={styles.symbol} aria-hidden="true">
            {kind === 'bible' ? '성' : '#'}
          </div>
          <div>
            <div className={styles.eyebrow}>바로 실행</div>
            <h2>{kind === 'bible' ? '성경 구절' : '슬라이드 이동'}</h2>
          </div>
          <span className={styles.dismiss}>ESC</span>
        </header>
        <p className={styles.description}>
          {kind === 'bible'
            ? '찾을 말씀의 책과 장, 절을 입력하세요.'
            : '예배 순서의 슬라이드 번호를 입력하세요.'}
        </p>
        <div className={styles.content}>{children}</div>
        <footer className={styles.footer}>
          <span>
            <kbd>Enter</kbd> {kind === 'bible' ? '바로 띄우기' : '이동'}
          </span>
          {kind === 'number' ? (
            <span>
              <kbd>Delete</kbd> 전체 지우기
            </span>
          ) : (
            <span>
              <kbd>Tab</kbd> 다음 칸
            </span>
          )}
          <span>
            <kbd>Esc</kbd> 닫기
          </span>
        </footer>
      </section>
    </div>,
    document.body,
  );
}

export function NumberJumpOverlay(): JSX.Element | null {
  const value = useNumberJump(state => state.value);
  if (draftOverlay === null || value === '') return null;
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
