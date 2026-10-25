import {useEffect, useId, useRef, useState, type JSX} from 'react';
import {mediaUrl} from '@shared/media';
import type {MediaId} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import {useShow} from '@renderer/state/show';
import {Button, Icon, Menu} from '@renderer/ui';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useTooltip} from '@renderer/ui/Tooltip';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import type {Notice} from '@renderer/ui/notices';
import {useSongBackground} from './useSongBackground';
import styles from './SongBackgroundControl.module.css';

const ICON_SIZE = 14;
const CHEVRON_SIZE = 12;
// TODO(0913vision): Enable relinking when P6a implements media.relink.
const RELINK_UNAVAILABLE = '현재 버전에서는 미디어 파일을 다시 연결할 수 없음';

function mediaName(media: MediaItem): string {
  return media.name === '' ? '이름 없는 미디어' : media.name;
}

function Picture({media}: {readonly media: MediaItem}): JSX.Element {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const element = video.current;
    return () => {
      if (element === null) return;
      element.pause();
      element.removeAttribute('src');
      element.load();
    };
  }, [media.id, media.kind]);
  return media.kind === 'image' ? (
    <img className={styles.picture} src={mediaUrl(media.id)} alt="" />
  ) : (
    <video
      key={media.id}
      ref={video}
      className={styles.picture}
      src={mediaUrl(media.id)}
      muted
      preload="metadata"
      aria-hidden="true"
    />
  );
}

function BackgroundWarning(): JSX.Element {
  const reason = '배경 파일을 찾을 수 없음';
  const {targetProps, tooltip} = useTooltip({text: reason});
  return (
    <>
      <span
        {...targetProps}
        role="img"
        aria-label={reason}
        className={styles.warning}
      >
        <Icon name="warning" size={ICON_SIZE} />
      </span>
      {tooltip}
    </>
  );
}

interface BackgroundSelectProps {
  readonly items: readonly MediaItem[];
  readonly selection: {
    readonly mediaId: MediaId | undefined;
    readonly inherited: boolean;
    readonly missing: boolean;
  };
  readonly readOnly?: boolean | undefined;
  readonly busy?: boolean | undefined;
  readonly onChoose: (mediaId: MediaId | null) => void;
}

/** The header's media choice with a still image or a paused video frame. */
export function SongBackgroundSelect({
  items,
  selection,
  readOnly = false,
  busy = false,
  onChoose,
}: BackgroundSelectProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');
  const valueId = useId();
  const defaultDescriptionId = useId();
  const choices = items.filter(item => item.kind !== 'audio');
  const selected = choices.find(item => item.id === selection.mediaId);
  const searchText = query.normalize('NFC').trim().toLocaleLowerCase('ko');
  const visible = choices.filter(item =>
    mediaName(item)
      .normalize('NFC')
      .toLocaleLowerCase('ko')
      .includes(searchText),
  );
  const disabled = readOnly || busy;
  const expanded = anchor !== null && !disabled;
  const value =
    selected === undefined
      ? selection.mediaId === undefined
        ? '없음'
        : '배경 파일 없음'
      : mediaName(selected);
  return (
    <div className={styles.controls}>
      {selection.missing ? (
        <>
          <BackgroundWarning />
          <Button disabled icon="refresh" title={RELINK_UNAVAILABLE}>
            다시 연결
          </Button>
        </>
      ) : null}
      <Button
        className={styles.select}
        aria-label="배경 선택"
        aria-describedby={
          selection.inherited ? `${valueId} ${defaultDescriptionId}` : valueId
        }
        aria-haspopup="menu"
        aria-expanded={expanded}
        aria-busy={busy}
        disabled={disabled}
        title={
          readOnly ? '읽기 전용 예배 순서' : busy ? '배경 변경 중' : undefined
        }
        onClick={event => {
          setQuery('');
          setAnchor(anchor === null ? event.currentTarget : null);
        }}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded,
            disabled,
            onExpandedChange: open => {
              setQuery('');
              setAnchor(open ? event.currentTarget : null);
            },
          })
        }
      >
        {selected !== undefined && !selection.missing ? (
          <Picture media={selected} />
        ) : (
          <Icon name={selection.missing ? 'filex' : 'film'} size={ICON_SIZE} />
        )}
        <TruncatedText id={valueId} text={value} className={styles.name} />
        {selection.inherited ? (
          <span id={defaultDescriptionId} className={styles.meta}>
            곡 기본값
          </span>
        ) : null}
        <Icon name="down" size={CHEVRON_SIZE} />
      </Button>
      {anchor !== null && !disabled ? (
        <Menu
          label="배경 선택"
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          search={{value: query, onChange: setQuery}}
          entries={[
            {
              kind: 'item',
              id: 'song-default',
              label: '곡 기본값',
              check: 'radio',
              checked: selection.inherited,
              onSelect: () => {
                onChoose(null);
                setAnchor(null);
              },
            },
            ...(visible.length === 0
              ? []
              : [{kind: 'separator' as const, id: 'media'}]),
            ...visible.map(item => ({
              kind: 'item' as const,
              id: item.id,
              label: mediaName(item),
              check: 'radio' as const,
              checked: !selection.inherited && item.id === selection.mediaId,
              onSelect: () => {
                onChoose(item.id);
                setAnchor(null);
              },
            })),
          ]}
        />
      ) : null}
    </div>
  );
}

function logProblem(notice: Notice): void {
  console.error('Song background control failed:', notice.key);
}

/** Connects the selected service song to the slide-header control. */
export function SongBackgroundControl({
  onProblem = logProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const background = useSongBackground(onProblem);
  const problem = useShow(view => {
    const row = view.rows.find(row => row.id === view.openItemId);
    return row?.kind === 'song' ? row.problem : undefined;
  });
  const {view} = background;
  if (view === null) return null;
  return (
    <SongBackgroundSelect
      key={`${view.serviceId}:${view.item.id}:${view.readOnly}`}
      items={view.media.value.items}
      selection={{
        mediaId: view.item.background ?? view.song?.song.background,
        inherited: view.item.background === undefined,
        missing: problem === 'missing-background',
      }}
      readOnly={view.readOnly}
      busy={background.busy}
      onChoose={background.choose}
    />
  );
}
