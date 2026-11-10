import {iconByKind} from '../order/serviceItemIcons';
import {createServiceItemId} from '@core/schema/ids';
import type {ServiceItem} from '@core/schema/service';
import {newSlidesItem} from '@core/services/slidesEdits';
import {sectionCardOf} from '@core/services/sectionCards';
import {PREPARATION_THEME_ID} from '@core/themes/sundayStandby';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {prepareSection} from './quickAddSection';
import {prepareLiturgy} from './quickAddLiturgy';

export const ELEMENT_DRAG_MIME = 'application/x-llp-service-element';
export const ORDER_ELEMENTS = [
  {id: 'standby', label: '예배 준비', icon: iconByKind.slides},
  {id: 'creed', label: '사도신경', icon: iconByKind.slides},
  {id: 'prayer', label: '주기도문', icon: iconByKind.slides},
  {id: 'bible', label: '성경 구절', icon: iconByKind.bible},
  {id: 'ad', label: '광고', icon: iconByKind.slides},
  {id: 'blank', label: '빈 슬라이드', icon: iconByKind.slides},
  {id: 'header', label: '구역', icon: 'folder'},
] as const;
export type OrderElementId = (typeof ORDER_ELEMENTS)[number]['id'];
export type PaletteKey = OrderElementId | `card:${string}`;
const SUNDAY_ORDER = [
  '묵상기도',
  '회개와간구의기도',
  '찬양',
  '합심기도',
  '봉헌',
  '봉헌기도',
  '축도',
];
export const PALETTE_SECTIONS = [
  ...SUNDAY_ORDER.flatMap(name =>
    SUNDAY_SECTIONS.filter(section => section.name === name),
  ),
  ...SUNDAY_SECTIONS.filter(
    section =>
      !SUNDAY_ORDER.includes(section.name) &&
      section.name !== '사도신경' &&
      section.name !== '광고',
  ),
];
export function isPaletteKey(key: string): key is PaletteKey {
  return (
    ORDER_ELEMENTS.some(item => item.id === key) ||
    PALETTE_SECTIONS.some(section => `card:${section.name}` === key)
  );
}
export async function createPaletteItem(
  key: string,
  translation: 'new' | 'old' = 'new',
): Promise<ServiceItem | null> {
  const id = createServiceItemId(crypto.randomUUID());
  if (key === 'header') return {id, header: '새 구역'};
  if (key === 'standby') {
    const blank = newSlidesItem('blank', id);
    return {
      ...blank,
      theme: PREPARATION_THEME_ID,
      slides: {...blank.slides, name: '예배 준비'},
    };
  }
  if (key === 'blank') return newSlidesItem('blank', id);
  if (key === 'ad' || key === 'creed') {
    const section = SUNDAY_SECTIONS.find(
      section => section.name === (key === 'ad' ? '광고' : '사도신경'),
    );
    if (!section) throw new Error('Section card is unavailable');
    await prepareSection(section);
    const item =
      key === 'ad'
        ? newSlidesItem('ad', id)
        : await prepareLiturgy('creed', translation);
    return {...item, sectionCard: sectionCardOf(section)};
  }
  if (key === 'prayer') return prepareLiturgy('prayer', translation);
  const section = PALETTE_SECTIONS.find(
    section => `card:${section.name}` === key,
  );
  return section ? prepareSection(section) : null;
}
