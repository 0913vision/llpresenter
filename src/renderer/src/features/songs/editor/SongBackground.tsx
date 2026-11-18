import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {
  use,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type JSX,
} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import {Select} from '@renderer/ui/Select';
import {keptDocument} from '@renderer/platform/useFollowedDocument';
import {usePrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {thumbnailReady} from '@renderer/rendering/pictures/thumbnailReady';
import {MediaPicker, NONE_LABEL} from './MediaPicker';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongBackground.module.css';
import {
  backgroundName,
  backgroundPicture,
  missingBackgroundTip,
} from '../../media/backgroundChoices';

/** Reads checked media while mounted; a delayed get cannot replace a newer push. */
export function SongBackground({
  store,
  session,
  busy,
}: {
  readonly store: SongEditorStore;
  readonly session: SongSession;
  readonly busy: boolean;
}): JSX.Element {
  const [state, setState] = useState<{
    doc: MediaDocument | null;
    failed: boolean;
  }>(() => ({
    doc: keptDocument({
      read: () => store.api.media.get(),
      follow: accept => store.api.media.subscribe(accept),
      kept: {
        owner: store.api.media,
        name: 'media',
        is: (document): document is MediaDocument =>
          'name' in document && document.name === 'media',
      },
    }),
    failed: false,
  }));
  const [retry, setRetry] = useState(0);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [query, setQuery] = useState('');
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const api = store.api.media;
  useEffect(() => {
    let alive = true;
    const accept = (doc: MediaDocument): void => {
      if (alive) {
        setState(current =>
          current.doc !== null && current.doc.revision >= doc.revision
            ? current
            : {doc, failed: false},
        );
      }
    };
    const stop = api.subscribe(accept);
    api.get().then(accept, (error: unknown) => {
      console.error('Song background media read failed', error);
      if (alive) {
        setState(current =>
          current.doc === null ? {...current, failed: true} : current,
        );
      }
    });
    return () => {
      alive = false;
      stop();
    };
  }, [api, retry]);
  const items = useMemo(
    () =>
      state.doc?.value.items.filter(
        item => item.kind !== 'audio' && item.internal !== true,
      ) ?? [],
    [state.doc],
  );
  const selected = items.find(item => item.id === session.background);
  const switching = usePrepPictureSwitch();
  if (switching && session.background !== undefined && !pictures.drawInPlace) {
    use(thumbnailReady(thumbnailSrc(session.background)));
  }
  const missing =
    session.background !== undefined &&
    selected === undefined &&
    backgroundPicture(session.background) === undefined;
  const disabled =
    session.readOnly || busy || (state.doc === null && !state.failed);
  if (disabled && anchor !== null) setAnchor(null);
  const reason = session.blocked
    ? '저장 오류'
    : session.readOnly
      ? NEWER_FILE_REASON
      : busy
        ? '저장 중'
        : state.failed
          ? '미디어 불러오기 실패, 클릭하여 다시 시도'
          : state.doc === null
            ? '미디어 불러오는 중'
            : missing
              ? missingBackgroundTip()
              : undefined;
  return (
    <div className={styles.control}>
      <label htmlFor={id}>기본 배경</label>
      <Select
        ref={trigger}
        id={id}
        aria-label="기본 배경"
        aria-busy={state.doc === null && !state.failed ? true : undefined}
        size="sm"
        value={
          session.background === undefined
            ? NONE_LABEL
            : backgroundName(items, session.background)
        }
        lead={
          selected === undefined
            ? undefined
            : {
                kind: 'media',
                src: thumbnailSrc(selected.id),
              }
        }
        title={reason}
        expanded={anchor !== null && !disabled}
        disabled={disabled}
        onExpandedChange={value => {
          if (state.failed) {
            setState({doc: null, failed: false});
            setRetry(current => current + 1);
          } else {
            if (value) setQuery('');
            setAnchor(value ? trigger.current : null);
          }
        }}
      />
      {anchor === null || disabled ? null : (
        <MediaPicker
          key={state.doc?.revision}
          anchor={anchor}
          items={items}
          selected={session.background}
          query={query}
          onQueryChange={setQuery}
          onSelect={value => session.setBackground(value)}
          onClose={restore => {
            setAnchor(null);
            if (restore) anchor.focus();
          }}
        />
      )}
    </div>
  );
}
