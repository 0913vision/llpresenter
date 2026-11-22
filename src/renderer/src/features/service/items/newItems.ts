import {createServiceItemId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {
  blankItem,
  openedLiturgy,
  openedNotices,
  preparationItem,
  standbyItem,
  titleItem,
  type LiturgyTranslation,
} from '@core/slides/items';
import {SERVICE_TITLES} from '@core/slides/titles';
import {slideMaking, useThemes} from '@renderer/platform/themes';
import {iconByKind} from '../order/serviceItemIcons';

export const PREP_PALETTE_LABEL = '예배 요소와 곡';
export const ELEMENT_DRAG_MIME = 'application/x-llp-service-element';
export const NEW_SECTION_NAME = '새 구역';

/** What can be put in the 예배 순서, in the order of the palette. */
export const ORDER_ELEMENTS = [
  {id: 'standby', label: '예배 준비', icon: iconByKind.blank},
  {id: 'creed', label: '사도신경', icon: iconByKind.liturgy},
  {id: 'prayer', label: '주기도문', icon: iconByKind.liturgy},
  {id: 'sermon', label: '설교', icon: iconByKind.sermon},
  {id: 'bible', label: '성경 구절', icon: iconByKind.bible},
  {id: 'ad', label: '광고', icon: iconByKind.notice},
  {id: 'blank', label: '빈 슬라이드', icon: iconByKind.blank},
  {id: 'header', label: '구역', icon: 'folder'},
  {id: 'waiting-screen', label: '대기 화면', icon: iconByKind.blank},
] as const;

const TITLE_ORDER = [
  '묵상기도',
  '회개와간구의기도',
  '찬양',
  '합심기도',
  '봉헌',
  '봉헌기도',
  '축도',
];

/** The titles of the palette: the ones of every service first. */
export const PALETTE_TITLES = [
  ...TITLE_ORDER.flatMap(name =>
    SERVICE_TITLES.filter(title => title.name === name),
  ),
  ...SERVICE_TITLES.filter(
    ({name}) =>
      !TITLE_ORDER.includes(name) && name !== '사도신경' && name !== '광고',
  ),
];

const TITLE = 'card:';
const OWN_TITLE = 'custom:';

export function titleKey(name: string): string {
  return `${TITLE}${name}`;
}

export function ownTitleKey(id: string): string {
  return `${OWN_TITLE}${id}`;
}

/** Whether a dragged key is something the palette offers. */
export function isPaletteKey(key: string): boolean {
  return (
    ORDER_ELEMENTS.some(item => item.id === key) ||
    key.startsWith(TITLE) ||
    key.startsWith(OWN_TITLE)
  );
}

/** A new item for a key of the palette; a passage is asked for elsewhere. */
export function newPaletteItem(
  key: string,
  translation: LiturgyTranslation = 'new',
): ServiceItem | null {
  const making = slideMaking();
  switch (key) {
    case 'header':
      return {
        id: createServiceItemId(crypto.randomUUID()),
        kind: 'header',
        name: NEW_SECTION_NAME,
      };
    case 'standby':
      return preparationItem(making);
    case 'waiting-screen':
      return standbyItem(making);
    case 'blank':
      return blankItem(making);
    case 'ad':
      return openedNotices(making);
    case 'creed':
    case 'prayer':
      return openedLiturgy(making, key, translation);
    default:
      break;
  }
  const title = key.startsWith(TITLE)
    ? SERVICE_TITLES.find(entry => titleKey(entry.name) === key)
    : useThemes
        .getState()
        .themes?.titles.find(entry => ownTitleKey(entry.id) === key);
  return title === undefined ? null : titleItem(making, title);
}
