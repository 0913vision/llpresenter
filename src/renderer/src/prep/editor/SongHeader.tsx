import {useLayoutEffect, useRef, useSyncExternalStore, type JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {TextField} from '@renderer/ui/TextField';
import {Tooltip} from '@renderer/ui/Tooltip';
import {isComposing} from '@renderer/ui/ime';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongHeader.module.css';
import {SongBackground} from './SongBackground';

/** The library source title and its service usage; edits share the song queue. */
export function SongHeader({
  store,
  session,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const titleFrame = useRef<HTMLDivElement>(null);
  const usedBy =
    state.library.find(entry => entry.id === session.document.song.id)
      ?.usedBy ?? [];
  useLayoutEffect(() => {
    const input = titleFrame.current?.querySelector('input');
    if (
      input === undefined ||
      input === null ||
      !store.consumeTitleFocus(state.titleFocus)
    ) {
      return;
    }
    input.focus();
    input.select();
  }, [store, state.titleFocus]);
  return (
    <header className={styles.header}>
      <div ref={titleFrame} className={styles.title}>
        <TextField
          aria-label="곡 제목"
          variant="title"
          block
          value={session.title.value}
          onChange={value => session.editTitle(value)}
          onBlur={() => session.finishTitle()}
          readOnly={session.readOnly || state.busy}
          title={
            session.blocked
              ? '저장 오류 해결 필요'
              : session.readOnly
                ? '읽기 전용 곡'
                : state.busy
                  ? '저장 중'
                  : undefined
          }
          invalid={session.title.reason !== undefined}
          invalidReason={session.title.reason}
          onKeyDown={event => {
            if (event.key === 'Enter' && !isComposing(event)) {
              event.preventDefault();
              event.stopPropagation();
              if (session.title.reason === undefined) session.endTyping();
            }
          }}
        />
      </div>
      <span className={styles.count}>
        슬라이드 {session.history.snapshot.song.slides.length}개
      </span>
      <span className={styles.library}>
        <Icon name="folder" size={12} />
        라이브러리
      </span>
      <Tooltip
        text={
          usedBy.map(service => service.name).join(', ') ||
          '사용 중인 예배 순서 없음'
        }
      >
        <span tabIndex={0} className={styles.used}>
          <Icon name="link" size={14} />
          예배 순서 {usedBy.length}곳
        </span>
      </Tooltip>
      <SongBackground store={store} session={session} busy={state.busy} />
    </header>
  );
}
