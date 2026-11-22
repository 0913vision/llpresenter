import {expect, it, vi} from 'vitest';
import type {ServiceItem} from '@core/schema/service';
import {changeSlides, withText} from '@core/slides/edits';
import {
  editItem,
  editItemSlides,
  editOpenService,
  redoService,
  undoService,
  useOpenService,
} from '@renderer/session/openService';
import {lyricsSlide, slideId} from '@fixtures/core/slides';
import {
  itemId,
  openServiceFixture,
} from '@fixtures/renderer/session/openServiceFixture';

const song = (number: number, text = '가사'): ServiceItem => ({
  id: itemId(number),
  kind: 'song',
  name: `곡 ${number}`,
  slides: [lyricsSlide(number, text)],
});

const shown = () =>
  useOpenService
    .getState()
    .service?.order.map(item => ('slides' in item ? item.slides : []))
    .flat()
    .map(slide => slide.texts['가사']);

const type = (number: number, text: string, key?: string) =>
  editItemSlides(
    itemId(number),
    slides =>
      changeSlides(slides, new Set([slideId(number)]), slide =>
        withText(slide, '가사', text),
      ),
    key === undefined ? {} : {key},
  );

it('shows an edit at once and sends it', async () => {
  const service = openServiceFixture([song(1), song(2)]);
  const saved = type(1, '바뀐 가사');
  expect(shown()).toEqual(['바뀐 가사', '가사']);
  expect(service.edit).toHaveBeenCalledOnce();
  expect(await saved).toEqual({ok: true, value: true});
  expect(service.item(itemId(1))).toMatchObject({
    slides: [{texts: {가사: '바뀐 가사'}}],
  });
});

it('sends nothing when nothing changes', async () => {
  const service = openServiceFixture([song(1)]);
  expect(await type(1, '가사')).toEqual({ok: true, value: false});
  expect(service.edit).not.toHaveBeenCalled();
});

it('undoes typing that goes on as one step', async () => {
  openServiceFixture([song(1)]);
  await Promise.all([
    type(1, '가', 'text'),
    type(1, '가나', 'text'),
    type(1, '가나다', 'text'),
  ]);
  await type(1, '다른 글');
  expect(useOpenService.getState().past).toHaveLength(2);
  await undoService();
  expect(shown()).toEqual(['가나다']);
  await undoService();
  expect(shown()).toEqual(['가사']);
  await redoService();
  expect(shown()).toEqual(['가나다']);
});

it('sends the newest text of typing that waits', async () => {
  const service = openServiceFixture([song(1)]);
  await Promise.all([
    type(1, '가', 'text'),
    type(1, '가나', 'text'),
    type(1, '가나다', 'text'),
  ]);
  expect(service.edit.mock.calls.length).toBeLessThan(3);
  expect(service.item(itemId(1))).toMatchObject({
    slides: [{texts: {가사: '가나다'}}],
  });
});

it('makes an edit again on a service that another window changed', async () => {
  const service = openServiceFixture([song(1), song(2)]);
  service.edit.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'stale', message: 'Invented conflict'},
  });
  expect(await type(1, '바뀐 가사')).toEqual({ok: true, value: true});
  expect(service.edit).toHaveBeenCalledTimes(2);
  expect(shown()).toEqual(['바뀐 가사', '가사']);
});

it('takes a refused edit back', async () => {
  const service = openServiceFixture([song(1)]);
  service.edit.mockResolvedValueOnce({
    ok: false,
    error: {reason: 'invalid', message: 'Invented refusal'},
  });
  expect((await type(1, '바뀐 가사')).ok).toBe(false);
  expect(shown()).toEqual(['가사']);
});

it('takes an edit back when main does not answer', async () => {
  const service = openServiceFixture([song(1)]);
  const log = vi.spyOn(service.api.log, 'write');
  service.edit.mockRejectedValueOnce(new Error('Invented failure'));
  expect((await type(1, '바뀐 가사')).ok).toBe(false);
  expect(shown()).toEqual(['가사']);
  expect(log).toHaveBeenCalled();
});

it('refuses an item that is gone, and a service of a newer version', async () => {
  openServiceFixture([song(1)]);
  expect((await editItem(itemId(9), item => item)).ok).toBe(false);
  openServiceFixture([song(1)], {readOnly: true});
  expect((await type(1, '바뀐 가사')).ok).toBe(false);
  expect(shown()).toEqual(['가사']);
});

it('does not undo over a change of another window', async () => {
  const service = openServiceFixture([song(1)]);
  await type(1, '바뀐 가사');
  service.replace({order: [song(1, '다른 창의 글')]});
  expect((await undoService()).ok).toBe(false);
  expect(shown()).toEqual(['다른 창의 글']);
});

it('forgets its steps when another service opens', async () => {
  openServiceFixture([song(1)]);
  await type(1, '바뀐 가사');
  expect(useOpenService.getState().past).toHaveLength(1);
  expect(
    (await editOpenService(({order}) => ({ok: true, value: order}))).ok,
  ).toBe(true);
});
