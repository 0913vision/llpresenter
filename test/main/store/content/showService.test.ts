import {expect, it} from 'vitest';
import {createMediaId, createServiceItemId} from '@core/schema/common/ids';
import type {ServiceItem} from '@core/schema/services/service';
import {pastDocument} from '@fixtures/core/serviceList';
import {lyricsSlide} from '@fixtures/core/slides';
import {buildShowService} from '@main/store/content/showService';

const WARM = createMediaId('60000000-0000-4000-8000-000000000011');
const GONE = createMediaId('60000000-0000-4000-8000-000000000012');
const ITEM = '70000000-0000-4000-8000-000000000001';
const OTHER = '70000000-0000-4000-8000-000000000002';

function rowsOf(order: readonly ServiceItem[], listed: readonly string[]) {
  return buildShowService({
    service: {
      data: {...pastDocument.service, order},
      access: 'editable',
    },
    songs: new Map(),
    labels: [],
    revision: 1,
    hasMedia: id => listed.includes(id),
  }).rows;
}

function blankItem(id: string, media: ReadonlyArray<string | undefined>) {
  return {
    id: createServiceItemId(id),
    kind: 'blank' as const,
    name: '광고',
    slides: media.map((background, index) =>
      lyricsSlide(
        index + 1,
        '',
        background === undefined
          ? {}
          : {background: {kind: 'media', media: createMediaId(background)}},
      ),
    ),
  } satisfies ServiceItem;
}

it('sends the media of an item backgrounds with its row, each once, for the windows to mark a missing file', () => {
  const [row] = rowsOf([blankItem(ITEM, [WARM, undefined, WARM])], [WARM]);
  expect(row).toMatchObject({media: [WARM]});
  expect(row).not.toHaveProperty('problem');
});

it('marks a row whose background left the media list, and sends no media for an item without backgrounds', () => {
  const [gone, plain] = rowsOf(
    [blankItem(ITEM, [GONE]), blankItem(OTHER, [undefined])],
    [WARM],
  );
  expect(gone).toMatchObject({problem: 'missing-media', media: [GONE]});
  expect(plain).not.toHaveProperty('media');
});
