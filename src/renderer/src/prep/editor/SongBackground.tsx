import {useEffect, useId, useMemo, useRef, useState, type JSX} from 'react';
import type {MediaDocument} from '@shared/schema/mediaEdit';
import {mediaUrl} from '@shared/media';
import {Select} from '@renderer/ui/Select';
import {MediaPicker, NONE_LABEL} from './MediaPicker';
import type {SongEditorStore} from './songEditorStore';
import type {SongSession} from './songSession';
import styles from './SongBackground.module.css';

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
  }>({doc: null, failed: false});
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
    () => state.doc?.value.items.filter(item => item.kind !== 'audio') ?? [],
    [state.doc],
  );
  const selected = items.find(item => item.id === session.background);
  const missing = session.background !== undefined && selected === undefined;
  const disabled =
    session.readOnly || busy || (state.doc === null && !state.failed);
  if (disabled && anchor !== null) setAnchor(null);
  const reason = session.blocked
    ? '저장 오류 해결 필요'
    : session.readOnly
      ? '읽기 전용 곡'
      : busy
        ? '저장 중'
        : state.failed
          ? '미디어 불러오기 실패, 클릭하여 다시 시도'
          : state.doc === null
            ? '미디어 불러오는 중'
            : missing
              ? '미디어를 찾을 수 없습니다'
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
        value={selected?.name ?? (missing ? '미디어 없음' : NONE_LABEL)}
        lead={
          selected === undefined
            ? undefined
            : {
                kind: 'media',
                mediaType: selected.kind === 'video' ? 'video' : 'image',
                src: mediaUrl(selected.id),
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
