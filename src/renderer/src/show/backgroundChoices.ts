import type {MediaId} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import type {MenuEntry} from '@renderer/ui/menuModel';

export const SONG_DEFAULT_LABEL = '곡 기본값';
const UNNAMED_MEDIA = '이름 없는 미디어';

export function mediaName(media: MediaItem): string {
  return media.name === '' ? UNNAMED_MEDIA : media.name;
}

/** The pictures a song item can take as its background: no audio. */
export function backgroundMedia(
  items: readonly MediaItem[],
): readonly MediaItem[] {
  return items.filter(item => item.kind !== 'audio');
}

function searchKey(value: string): string {
  return value.normalize('NFC').trim().toLocaleLowerCase('ko');
}

export interface BackgroundChoices {
  readonly items: readonly MediaItem[];
  readonly query: string;
  /** The background shown now: the item's override or the song's. */
  readonly mediaId: MediaId | undefined;
  /** Whether the item follows the song's background. */
  readonly inherited: boolean;
  /** `null` asks for the song's background again. */
  readonly onChoose: (mediaId: MediaId | null) => void;
}

/** 곡 기본값, then the media whose name matches the search. */
export function backgroundEntries({
  items,
  query,
  mediaId,
  inherited,
  onChoose,
}: BackgroundChoices): readonly MenuEntry[] {
  const key = searchKey(query);
  const visible = backgroundMedia(items).filter(item =>
    searchKey(mediaName(item)).includes(key),
  );
  return [
    {
      kind: 'item',
      id: 'song-default',
      label: SONG_DEFAULT_LABEL,
      check: 'radio',
      checked: inherited,
      onSelect: () => onChoose(null),
    },
    ...(visible.length === 0
      ? []
      : [{kind: 'separator' as const, id: 'media'}]),
    ...visible.map((item): MenuEntry => ({
      kind: 'item',
      id: item.id,
      label: mediaName(item),
      check: 'radio',
      checked: !inherited && item.id === mediaId,
      onSelect: () => onChoose(item.id),
    })),
  ];
}
