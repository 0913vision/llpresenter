import {expect, it, vi} from 'vitest';
import type {ShowTile} from '@core/schema/showService';
import {BibleSlideSession} from '@renderer/features/service/items/BibleSlideSession';
import {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {itemFixture} from '@fixtures/renderer/features/service/items/itemFixture';

it('keeps Bible part selections when the editor session is rebuilt', async () => {
  const fixture = itemFixture();
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, vi.fn());
  const tiles: readonly ShowTile[] = [
    {label: '1', labelColor: 'none', lines: ['one']},
    {label: '2', labelColor: 'none', lines: ['two']},
    {label: '3', labelColor: 'none', lines: ['three']},
  ];
  const options = {items, offset: 0, readOnly: false};
  const session = new BibleSlideSession('item', tiles, options);
  session.selectSlides({type: 'click', id: '2', ctrl: true});
  expect(items.getSnapshot().bibleSelection).toEqual([0, 2]);
  expect(items.getSnapshot().position).toBe(2);
  const rebuilt = new BibleSlideSession('item', tiles, options);
  expect([...rebuilt.slideModel.getSnapshot().selection.ids]).toEqual([
    '0',
    '2',
  ]);
  items.dispose();
  await editor.dispose();
});
