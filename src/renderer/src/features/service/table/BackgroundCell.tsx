import {useState, type JSX} from 'react';
import {thumbnailSrc} from '@contracts/ipc/thumbnailRevisions';
import type {ItemRow} from '@core/presentation/model';
import {parseMediaId, type MediaId} from '@core/schema/ids';
import type {MediaItem} from '@core/schema/mediaList';
import {isItemOfKind, type ServiceItem} from '@core/schema/service';
import {
  backgroundName,
  SONG_DEFAULT_LABEL,
} from '@renderer/features/media/backgroundChoices';
import {MediaPicker} from '@renderer/features/songs/editor/MediaPicker';
import {classNames} from '@renderer/ui/classNames';
import {titleTooltip, useTooltip, withTooltipProps} from '@renderer/ui/Tooltip';
import {CellButton} from './CellButton';
import styles from './ServiceTable.module.css';

const NONE = '없음';
/** Noneditable cells stay blank when this item kind has no background. */
const EMPTY = '';

/** What the background cell shows: the picture and the name that will play. */
function Shown({
  media,
  name,
}: {
  readonly media: MediaId | undefined;
  readonly name: string;
}): JSX.Element {
  return (
    <>
      {media === undefined ? null : (
        <img className={styles.thumb} src={thumbnailSrc(media)} alt="" />
      )}
      <span className={styles.truncate}>{name}</span>
    </>
  );
}

/** The 배경 of an item row: a still and name, or 없음 when an editable cell has none. */
export function BackgroundCell({
  row,
  presentation = 'cell',
  rowLabel,
  item,
  media,
  songBackground,
  reason,
  choose,
}: {
  readonly row: ItemRow;
  readonly presentation?: 'cell' | 'ribbon';
  readonly rowLabel: string;
  readonly item: ServiceItem | undefined;
  readonly media: readonly MediaItem[];
  /** The library song's own background, for a song item. */
  readonly songBackground: MediaId | undefined;
  readonly reason: string | undefined;
  /** Picks a file for this item, or the song's own with null; undefined for a kind that has none. */
  readonly choose: ((mediaId: MediaId | null) => void) | undefined;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const background = 'background' in row ? row.background : undefined;
  const parsed =
    background === undefined ? undefined : parseMediaId(background.mediaId);
  const playing = parsed?.ok === true ? parsed.value : undefined;
  const own = item !== undefined && 'background' in item;
  const slidesItem =
    item !== undefined && isItemOfKind(item, 'slides') ? item : undefined;
  const selectedBackground = slidesItem?.background ?? playing;
  const shown =
    selectedBackground === undefined
      ? {media: undefined, name: choose === undefined ? EMPTY : NONE}
      : {
          media: selectedBackground,
          name:
            slidesItem === undefined
              ? (background?.title ?? backgroundName(media, selectedBackground))
              : backgroundName(media, selectedBackground),
        };
  const {targetProps, tooltip} = useTooltip(titleTooltip(undefined));
  if (choose === undefined) {
    return (
      <>
        <span
          {...withTooltipProps({}, targetProps)}
          className={classNames(
            styles.cell,
            styles.background,
            !own && styles.dim,
          )}
        >
          <Shown {...shown} />
        </span>
        {tooltip}
      </>
    );
  }
  return (
    <>
      <CellButton
        presentation={presentation}
        label={`배경, ${rowLabel}`}
        width={styles.background}
        dim={!own}
        reason={reason}
        expanded={open}
        popup="listbox"
        buttonRef={setButton}
        onOpen={() => {
          setQuery('');
          setOpen(true);
        }}
      >
        <Shown {...shown} />
      </CellButton>
      {open && button !== null ? (
        <MediaPicker
          label="배경 선택"
          anchor={button}
          items={media}
          selected={own ? playing : undefined}
          defaultChoice={{
            label: slidesItem === undefined ? SONG_DEFAULT_LABEL : NONE,
            detail: backgroundName(media, songBackground),
          }}
          query={query}
          onQueryChange={setQuery}
          onSelect={mediaId => choose(mediaId ?? null)}
          onClose={restore => {
            setOpen(false);
            if (restore) button.focus();
          }}
        />
      ) : null}
    </>
  );
}
