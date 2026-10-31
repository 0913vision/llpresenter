import {useLayoutEffect, useRef, useSyncExternalStore, type JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {TextField} from '@renderer/ui/TextField';
import {Tooltip} from '@renderer/ui/Tooltip';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
import {slideCountOf} from '@core/songs/blockEdits';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongHeader.module.css';
import {SongBackground} from './SongBackground';
import type {SongId} from '@core/schema/ids';
import {ImportedSongActions} from '../import/ImportedSongActions';
import {songUsage} from './songUsage';

/** The library source title and its service usage; edits share the song queue. */
export function SongHeader({
  store,
  session,
  onImportedSave,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const titleFrame = useRef<HTMLDivElement>(null);
  const {
    unavailable: usageUnavailable,
    text: usageText,
    tooltip: usageTip,
  } = songUsage(state.library, state.libraryStatus, session.document.song.id);
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
            if (
              event.key === 'Enter' &&
              !isComposing(event) &&
              !hasModifier(event)
            ) {
              event.preventDefault();
              event.stopPropagation();
              if (session.title.reason === undefined) session.endTyping();
            }
          }}
        />
      </div>
      <span className={styles.count}>
        슬라이드 {slideCountOf(session.history.snapshot.song)}개
      </span>
      {state.imported ? null : (
        <>
          <span className={styles.library}>
            <Icon name="folder" size={12} />
            라이브러리
          </span>
          <Tooltip text={usageTip}>
            <span
              tabIndex={0}
              className={styles.used}
              data-unavailable={usageUnavailable || undefined}
            >
              <Icon name={usageUnavailable ? 'warning' : 'link'} size={14} />
              {usageText}
            </span>
          </Tooltip>
        </>
      )}
      <SongBackground store={store} session={session} busy={state.busy} />
      {state.imported ? (
        <ImportedSongActions store={store} onSaved={onImportedSave} />
      ) : null}
    </header>
  );
}
