import {createServiceItemId, type NoticeSetId} from '@shared/schema/ids';
import type {MediaItem} from '@shared/schema/mediaList';
import type {ServiceItem} from '@shared/schema/service';
import type {MenuEntry} from '@renderer/ui/menuModel';

const SECTION_NAME = '새 구역';
const UNNAMED_MEDIA = '이름 없는 미디어';

export interface NoticeSetChoice {
  readonly id: NoticeSetId;
  readonly name: string;
}

export interface OtherItemChoices {
  readonly media: readonly MediaItem[];
  readonly notices: readonly NoticeSetChoice[];
  readonly onInsert: (item: ServiceItem) => void;
  /** Switches the popover to typing a passage reference. */
  readonly onBible: () => void;
}

function newId(): ServiceItem['id'] {
  return createServiceItemId(crypto.randomUUID());
}

function submenu(
  prefix: string,
  entries: readonly MenuEntry[],
  empty: string,
): readonly MenuEntry[] {
  return entries.length > 0
    ? entries
    : [{kind: 'item', id: `${prefix}:none`, label: empty, disabled: true}];
}

/** Commands in the service order's other-items group. */
export function otherItemEntries({
  media,
  notices,
  onInsert,
  onBible,
}: OtherItemChoices): readonly MenuEntry[] {
  return [
    {kind: 'group', id: 'other', label: '다른 항목'},
    {
      kind: 'item',
      id: 'other:header',
      label: '구역 추가',
      icon: 'rows',
      onSelect: () => onInsert({id: newId(), header: SECTION_NAME}),
    },
    {
      kind: 'item',
      id: 'other:bible',
      label: '성경 구절',
      icon: 'book',
      keepsOpen: true,
      onSelect: onBible,
    },
    {
      kind: 'item',
      id: 'other:media',
      label: '미디어',
      icon: 'film',
      submenu: submenu(
        'media',
        media
          .filter(item => item.kind !== 'audio')
          .map((item): MenuEntry => ({
            kind: 'item',
            id: `media:${item.id}`,
            label: item.name === '' ? UNNAMED_MEDIA : item.name,
            onSelect: () => onInsert({id: newId(), media: item.id}),
          })),
        '미디어 없음',
      ),
    },
    {
      kind: 'item',
      id: 'other:notice',
      label: '공지',
      icon: 'notice',
      submenu: submenu(
        'notice',
        notices.map((set): MenuEntry => ({
          kind: 'item',
          id: `notice:${set.id}`,
          label: set.name,
          onSelect: () => onInsert({id: newId(), notice: set.id}),
        })),
        '공지 없음',
      ),
    },
  ];
}
