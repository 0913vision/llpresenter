import {NOT_YET} from '@renderer/ui/menuRows';
import {NEWER_FILE_REASON} from '@renderer/platform/problemReasons';
import {useId, useState, type JSX} from 'react';
import {mediaUrl, thumbnailUrl} from '@contracts/ipc/mediaUrls';
import type {MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {useShow} from '@renderer/session/show';
import {Button, Icon} from '@renderer/ui';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useTooltip} from '@renderer/ui/Tooltip';
import {TruncatedText} from '@renderer/ui/TruncatedText';
import type {Notice} from '@renderer/ui/notices';
import {
  backgroundName,
  backgroundMedia,
  mediaName,
  SONG_DEFAULT_LABEL,
} from '../../media/backgroundChoices';
import {useSongBackground} from './useSongBackground';
import {MISSING_BACKGROUND_TIP} from '../../../platform/problemReasons';
import styles from './SongBackgroundControl.module.css';

const ICON_SIZE = 14;
const CHEVRON_SIZE = 12;
// TODO(0913vision): Enable relinking when P6a implements media.relink.

function Picture({media}: {readonly media: MediaItem}): JSX.Element {
  return (
    <img
      className={styles.picture}
      src={media.kind === 'video' ? thumbnailUrl(media.id) : mediaUrl(media.id)}
      alt=""
    />
  );
}

function BackgroundWarning(): JSX.Element {
  const reason = MISSING_BACKGROUND_TIP;
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
  readonly defaultMediaId?: MediaId | undefined;
  readonly selection: {
    readonly mediaId: MediaId | undefined;
    readonly inherited: boolean;
    readonly missing: boolean;
  };
  readonly readOnly?: boolean | undefined;
  readonly busy?: boolean | undefined;
  readonly onChoose: (mediaId: MediaId | null) => void;
}

/** The header's media choice with a still image or cached video thumbnail. */
export function SongBackgroundSelect({
  items,
  defaultMediaId,
  selection,
  readOnly = false,
  busy = false,
  onChoose,
}: BackgroundSelectProps): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [query, setQuery] = useState('');
  const valueId = useId();
  const defaultDescriptionId = useId();
  const selected = backgroundMedia(items).find(
    item => item.id === selection.mediaId,
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
          <Button disabled icon="refresh" title={NOT_YET}>
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
        aria-haspopup="listbox"
        aria-expanded={expanded}
        aria-busy={busy}
        disabled={disabled}
        title={readOnly ? NEWER_FILE_REASON : busy ? '배경 변경 중' : undefined}
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
            {SONG_DEFAULT_LABEL}
          </span>
        ) : null}
        <Icon name="down" size={CHEVRON_SIZE} />
      </Button>
      {anchor !== null && !disabled ? (
        <MediaPicker
          label="배경 선택"
          anchor={anchor}
          items={items}
          selected={selection.inherited ? undefined : selection.mediaId}
          defaultChoice={{
            label: SONG_DEFAULT_LABEL,
            detail: backgroundName(items, defaultMediaId),
          }}
          query={query}
          onQueryChange={setQuery}
          onSelect={mediaId => onChoose(mediaId ?? null)}
          onClose={restore => {
            setAnchor(null);
            if (restore) anchor.focus();
          }}
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
      defaultMediaId={view.song?.song.background}
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
