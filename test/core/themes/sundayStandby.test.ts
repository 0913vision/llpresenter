import {expect, it} from 'vitest';
import {createScreenId} from '@core/schema/ids';
import {createDefaultThemes} from '@core/themes/defaults';
import {SUNDAY_STANDBY_PICTURE_IDS} from '@core/themes/sundayStandby';

const audience = createScreenId('00000000-0000-4000-8000-000000000901');
const broadcast = createScreenId('00000000-0000-4000-8000-000000000902');
const stage = createScreenId('00000000-0000-4000-8000-000000000903');
const screens = [
  {id: audience, kind: 'audience', method: 'fullscreen'},
  {id: broadcast, kind: 'broadcast', method: 'capture'},
  {id: stage, kind: 'stage', method: 'fullscreen'},
] as const;

it('gives configured audience screens editable service times while preserving other standby screens', () => {
  const file = createDefaultThemes(screens);
  const layout = file.standby.screens[audience];
  expect(layout?.elements[0]).toMatchObject({
    kind: 'image',
    mediaId: SUNDAY_STANDBY_PICTURE_IDS.serviceTimesBright,
  });
  const words = layout?.elements.filter(element => element.kind === 'text');
  expect(words?.map(element => element.content)).toEqual([
    'LOVELIGHT',
    'SUN\nSUN\nSUN\nSUN\nWED\nFRI\nWEEK',
    'AM 08:00\nAM 11:30\nAM 11:30\nPM 01:30\nPM 08:00\nPM 09:00\nAM 09:00',
    '주일 1부 예배\n청소년부 예배\n주일 2부 예배\n청년부 예배\n수요 예배\n금요 예배\n아침 기도회',
    expect.stringContaining('(에베소서 3:20-21)'),
  ]);
  expect(words?.slice(1, 4).map(element => element.text)).toMatchObject([
    {font: 'Noto Sans CJK KR', weight: 100, align: 'right'},
    {font: 'Noto Sans CJK KR', weight: 400},
    {font: 'KoPubWorldDotum', weight: 500},
  ]);
  for (const word of words ?? []) {
    expect(word.text).toMatchObject({
      color: '#FFFFFF',
      shadow: {on: false},
      outline: {on: false},
    });
  }
  expect(file.standby.screens[broadcast]).toBeUndefined();
  expect(
    file.standby.screens[stage]?.elements.map(element => element.kind),
  ).toEqual(['clock', 'timer']);
});

it('offers preparation as a separate theme whose audience words need no slide content', () => {
  const file = createDefaultThemes(screens);
  const preparation = file.themes.find(theme => theme.name === '예배 준비');
  expect(preparation).toBeDefined();
  expect(preparation?.id).not.toBe(file.standby.id);
  expect(Object.values(file.defaults)).not.toContain(preparation?.id);
  expect(file.defaults.blank).toBe(file.defaults.bible);
  expect(preparation?.screens[audience]?.elements).toMatchObject([
    {kind: 'image', mediaId: SUNDAY_STANDBY_PICTURE_IDS.preparation},
    {kind: 'text', content: '잠시후에 예배가 시작됩니다'},
    {kind: 'text', content: '지금은 기도로 예배를 준비하는 시간입니다'},
  ]);
  expect(
    preparation?.screens[broadcast]?.elements.map(element => element.kind),
  ).toEqual(['currentText']);
  expect(
    preparation?.screens[stage]?.elements.some(
      element => element.kind === 'clock',
    ),
  ).toBe(true);
});
