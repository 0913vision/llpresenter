import type {MediaId} from '@core/schema/common/ids';
import type {MediaItem} from '@core/schema/media/mediaList';
import type {ServiceItem} from '@core/schema/services/service';
import {mediaName} from '@renderer/features/media/mediaEntries';
import {mediaAddAvailability} from '@renderer/platform/mediaAddAvailability';
import type {MenuEntry} from '@renderer/ui/menus/menuModel';
import {laterRow, menuSeparator} from '@renderer/ui/menus/menuRows';
import {newMediaItem} from '@renderer/features/media/newMediaItem';
import {iconByKind} from '../serviceItemIcons';
import {ORDER_ELEMENTS, PALETTE_TITLES, titleKey} from './newItems';
import type {InsertOptions} from './usePaletteInsert';

export interface QuickAddChoices {
  readonly media: readonly MediaItem[];
  readonly missing: ReadonlySet<MediaId> | null;
  readonly failed: boolean;
  /** Puts an element of the 예배 요소 list in, as the list does. */
  readonly onElement: (key: string, options?: InsertOptions) => void;
  readonly onMedia: (item: ServiceItem) => void;
  readonly onSong: () => void;
}

/** Elements that open in the editor to be filled in at once. */
const FILLED_IN: ReadonlySet<string> = new Set(['ad', 'blank']);
/** Elements that ask for a passage first. */
const ASKING: ReadonlySet<string> = new Set(['bible', 'sermon']);

function mediaEntries({
  media,
  missing,
  failed,
  onMedia,
}: QuickAddChoices): readonly MenuEntry[] {
  const files = media.filter(item => item.internal !== true);
  if (files.length === 0) {
    return [
      {
        kind: 'item',
        id: 'media:none',
        label: '미디어 없음',
        disabled: true,
        title: '미디어 없음',
      },
    ];
  }
  const waiting =
    missing !== null
      ? undefined
      : failed
        ? '상태를 확인하지 못했습니다.'
        : '불러오는 중';
  return files.map(item => ({
    kind: 'item',
    id: `media:${item.id}`,
    label: mediaName(item),
    ...mediaAddAvailability(missing?.has(item.id) === true, waiting),
    onSelect: () => {
      if (missing !== null && !missing.has(item.id)) {
        onMedia(newMediaItem(item));
      }
    },
  }));
}

/**
 * What the plus of the 예배 순서 offers: 곡…, then the 예배 요소 list in its
 * order with its icons, its 타이틀 and the 미디어.
 */
export function quickAddEntries(
  choices: QuickAddChoices,
): readonly MenuEntry[] {
  const {onElement, onSong} = choices;
  const elements = ORDER_ELEMENTS.map((element): MenuEntry => {
    const {id, label, icon} = element;
    if (id === 'creed' || id === 'prayer') {
      return {
        kind: 'item',
        id: `other:${id}`,
        label,
        icon,
        submenu: (['new', 'old'] as const).map(translation => ({
          kind: 'item',
          id: `${id}:${translation}`,
          label: translation === 'new' ? '새 번역' : '옛 번역',
          onSelect: () => onElement(id, {translation}),
        })),
      };
    }
    return {
      kind: 'item',
      id: `other:${id}`,
      label: ASKING.has(id) ? `${label}…` : label,
      icon,
      onSelect: () => onElement(id, {edit: FILLED_IN.has(id)}),
    };
  });
  return [
    {
      kind: 'item',
      id: 'other:song',
      label: '곡…',
      icon: iconByKind.song,
      onSelect: onSong,
    },
    menuSeparator('other:elements'),
    ...elements,
    {
      kind: 'item',
      id: 'other:section-card',
      label: '타이틀',
      icon: iconByKind.blank,
      submenu: PALETTE_TITLES.map(title => ({
        kind: 'item',
        id: `section-card:${title.name}`,
        label: title.name,
        onSelect: () => onElement(titleKey(title.name)),
      })),
    },
    {
      kind: 'item',
      id: 'other:media',
      label: '미디어',
      icon: iconByKind.media,
      submenu: mediaEntries(choices),
    },
    menuSeparator('other:later'),
    laterRow('other:cue', '빈 항목 추가', {icon: 'note'}),
    laterRow('other:video-stream', '영상 스트림 항목…', {icon: 'capture'}),
    laterRow('other:audio-stream', '오디오 스트림 항목…', {icon: 'audio'}),
  ];
}
