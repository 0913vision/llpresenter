import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {TextField} from '@renderer/ui/TextField';
import {Tooltip} from '@renderer/ui/Tooltip';
import {isComposing} from '@renderer/ui/ime';
import {hasModifier} from '@renderer/ui/modifierKeys';
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
  unsaved = false,
  back,
  actions,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
  readonly unsaved?: boolean;
  readonly back?: ReactNode;
  readonly actions?: ReactNode;
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
    <header
      className={styles.header}
      data-inline={back !== undefined || undefined}
    >
      {back}
      {unsaved ? (
        <Tooltip text="저장하지 않은 변경">
          <span
            className={styles.unsaved}
            role="img"
            aria-label="저장하지 않은 변경"
          />
        </Tooltip>
      ) : (
        <span className={styles.unsaved} data-empty aria-hidden="true" />
      )}
      <div ref={titleFrame} className={styles.title}>
        <TextField
          aria-label="곡 제목"
          variant="title"
          block
          value={session.title.value}
          onChange={value => session.editTitle(value)}
          onBlur={() => session.finishTitle()}
          readOnly={session.readOnly || session.itemSession || state.busy}
          title={
            session.blocked
              ? '저장 오류'
              : session.readOnly
                ? NEWER_FILE_REASON
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
      {actions}
      {state.imported ? (
        <ImportedSongActions store={store} onSaved={onImportedSave} />
      ) : null}
      {state.imported || session.itemSession ? null : (
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
      )}
      {session.itemSession ? null : (
        <SongBackground store={store} session={session} busy={state.busy} />
      )}
    </header>
  );
}
