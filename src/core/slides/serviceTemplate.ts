import {
  createServiceItemId,
  createTemplateId,
  type ServiceItemId,
} from '../schema/ids';
import {defaultSlideTransitions} from '../schema/preferences';
import type {ServiceItem, Template} from '../schema/service';
import {
  openedLiturgy,
  openedNotices,
  preparationItem,
  titleItem,
} from './items';
import type {SlideMaking} from './make';
import {serviceTitle} from './titles';

const itemId = (): ServiceItemId => createServiceItemId(crypto.randomUUID());

const header = (name: string): ServiceItem => ({
  id: itemId(),
  kind: 'header',
  name,
});

/** The order of a Sunday service of the church, ready to be filled in. */
export function sundayTemplate(): Template {
  const making: SlideMaking = {
    themes: null,
    transitions: defaultSlideTransitions,
  };
  const order: ServiceItem[] = [header('예배 전'), preparationItem(making)];
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
    order.push(header(name));
    if (name === '말씀') continue;
    if (name === '사도신경') order.push(openedLiturgy(making, 'creed'));
    else if (name === '광고') order.push(openedNotices(making));
    else order.push(titleItem(making, serviceTitle(name)));
  }
  return {
    format: 'llservice',
    schemaVersion: 1,
    id: createTemplateId(crypto.randomUUID()),
    name: '주일 2부 예배',
    order,
  };
}
