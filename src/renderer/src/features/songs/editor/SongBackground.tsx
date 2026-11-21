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
import {Button} from '@renderer/ui/Button';
import {Popover} from '@renderer/ui/Popover';
import {GeometryField} from '@renderer/ui/GeometryField';
import {THEME_LIMITS} from '@core/themes/elementRules';
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
  const [geometryAnchor, setGeometryAnchor] = useState<HTMLElement | null>(
    null,
  );
  const geometry = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const api = store.api.media;
  useEffect(() => {
    if (geometryAnchor === null) return;
    const outside = (event: PointerEvent): void => {
      if (!(event.target instanceof Node)) return;
      if (
        geometry.current?.contains(event.target) ||
        geometryAnchor.contains(event.target)
      ) {
        return;
      }
      setGeometryAnchor(null);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setGeometryAnchor(null);
      geometryAnchor.focus();
    };
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('keydown', escape, true);
    return () => {
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('keydown', escape, true);
    };
  }, [geometryAnchor]);
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
      {session.background === undefined ? null : (
        <Button
          disabled={disabled}
          onClick={event =>
            setGeometryAnchor(
              geometryAnchor === null ? event.currentTarget : null,
            )
          }
        >
          위치와 크기
        </Button>
      )}
      {geometryAnchor === null || disabled ? null : (
        <Popover>
          <div
            ref={geometry}
            className={styles.geometry}
            role="dialog"
            aria-label="배경 위치와 크기"
            style={{
              top: geometryAnchor.getBoundingClientRect().bottom + 4,
              left: Math.max(
                8,
                geometryAnchor.getBoundingClientRect().right - 240,
              ),
            }}
          >
            {(['x', 'y', 'w', 'h'] as const).map(field => {
              const frame = session.backgroundFrame ?? {
                x: 0,
                y: 0,
                w: THEME_LIMITS.width,
                h: THEME_LIMITS.height,
              };
              const max =
                field === 'x'
                  ? THEME_LIMITS.width - frame.w
                  : field === 'y'
                    ? THEME_LIMITS.height - frame.h
                    : field === 'w'
                      ? THEME_LIMITS.width - frame.x
                      : THEME_LIMITS.height - frame.y;
              return (
                <label key={field}>
                  {field.toUpperCase()}
                  <GeometryField
                    aria-label={`배경 ${field.toUpperCase()}`}
                    value={frame[field]}
                    min={
                      field === 'x' || field === 'y'
                        ? 0
                        : THEME_LIMITS.minimumExtent
                    }
                    max={max}
                    updateOn="commit"
                    unit="px"
                    onChange={value =>
                      session.setBackgroundFrame({...frame, [field]: value})
                    }
                  />
                </label>
              );
            })}
            <Button
              onClick={() => {
                setGeometryAnchor(null);
                geometryAnchor.focus();
              }}
            >
              닫기
            </Button>
          </div>
        </Popover>
      )}
    </div>
  );
}
