import {
  createServiceItemId,
  createTemplateId,
  type ServiceItemId,
} from '../schema/ids';
import type {ServiceItem, Template} from '../schema/service';
import {SUNDAY_SECTIONS} from '../themes/sundaySections';
import {PREPARATION_THEME_ID} from '../themes/sundayStandby';
import {newLiturgyItem} from './liturgy';
import {newSectionItem, sectionCardOf} from './sectionCards';
import {newSlidesItem} from './slidesEdits';

const itemId = () => createServiceItemId(crypto.randomUUID());

/** The service preparation item shared by the template and palette. */
export function newSundayPreparation(id: ServiceItemId): ServiceItem {
  const blank = newSlidesItem('blank', id);
  return {
    ...blank,
    theme: PREPARATION_THEME_ID,
    slides: {...blank.slides, name: '예배 준비'},
  };
}

/** The prefilled announcement with its leading section card. */
export function newSundayAnnouncement(id: ServiceItemId): ServiceItem {
  const section = SUNDAY_SECTIONS.find(value => value.name === '광고');
  if (section === undefined) throw Error('Missing notice section');
  const notice = newSlidesItem('ad', id);
  const slide = notice.slides.slides[0];
  if (slide === undefined || !('text' in slide)) {
    throw Error('Missing notice slide');
  }
  return {
    ...notice,
    sectionCard: sectionCardOf(section),
    slides: {
      ...notice.slides,
      slides: [{...slide, name: '광고 제목', text: '내용 1\n내용 2'}],
    },
  };
}

/** Ordinary editable items and empty content sections in the church's order. */
export function sundayTemplate(): Template {
  const order: ServiceItem[] = [
    {id: itemId(), header: '예배 전'},
    newSundayPreparation(itemId()),
  ];
  for (const name of [
    '묵상기도',
    '사도신경',
    '회개와간구의기도',
    '찬양',
    '합심기도',
    '말씀',
    '봉헌',
    '봉헌기도',
    '광고',
    '축도',
  ]) {
    order.push({id: itemId(), header: name});
    if (name === '말씀') continue;
    const section = SUNDAY_SECTIONS.find(section => section.name === name);
    if (section === undefined) throw Error(`Missing section card: ${name}`);
    if (name === '사도신경') {
      order.push({
        ...newLiturgyItem(itemId(), {kind: 'creed', translation: 'new'}),
        sectionCard: sectionCardOf(section),
      });
    } else if (name === '광고') {
      order.push(newSundayAnnouncement(itemId()));
    } else {
      order.push(newSectionItem(itemId(), section));
    }
  }
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: createTemplateId(crypto.randomUUID()),
    name: '주일 2부 예배',
    time: '11:30',
    order,
  };
}
