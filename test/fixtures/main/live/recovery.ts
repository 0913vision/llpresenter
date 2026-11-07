import {isRecord} from '@core/common/guards';
import {fixtureSlideId} from '@fixtures/core/songs/slideFixtures';
import {emptyLiveState} from '@core/live/state';
import {createServiceId, createServiceItemId} from '@core/schema/ids';
import {
  parseRecoveryRecord,
  type RecoveryRecord,
} from '@core/schema/recoveryRecord';
import {parseService} from '@core/schema/service';
import {parseSong} from '@core/schema/song';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';
import type {RecoveryContent} from '@main/live/recovery/plan';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  EVENING_ID,
  SUNDAY_ID,
} from '@fixtures/main/store/testFiles';

export const SAVED_AT = '2026-10-26T06:00:00+09:00';
export const SAVED_AT_MS = Date.parse(SAVED_AT);
export const SERVICE = createServiceId(SUNDAY_ID);
export const OTHER_SERVICE = createServiceId(EVENING_ID);
export const SONG_ITEM = createServiceItemId(itemId(101));
export const HEADER_ITEM = createServiceItemId(itemId(102));
export const MISSING_SONG_ITEM = createServiceItemId(itemId(103));

function serviceOf(id: string, order: readonly object[]) {
  return expectSuccess(
    parseService(
      JSON.stringify(service(id, '2026-11-01T11:00', order)),
      `${id}.llservice`,
    ),
  ).data;
}

/**
 * Two services: the first has a song item with five independent slides, a header,
 * and a song that is gone; the second, listed first, has only a header.
 */
export function recoveryContent(): RecoveryContent {
  const hymn = expectSuccess(
    parseSong(JSON.stringify(hymnOne()), 'hymn.llsong'),
  ).data;
  const slides = Array.from({length: 5}, (_, index) => {
    const slide = hymn.slides[index % hymn.slides.length];
    if (slide === undefined) throw new Error('Missing hymn slide');
    return {...slide, id: fixtureSlideId(index + 1)};
  });
  const services = new Map<string, ReturnType<typeof serviceOf>>(
    [
      serviceOf(EVENING_ID, [{id: itemId(104), header: '찬양'}]),
      serviceOf(SUNDAY_ID, [
        {slides, id: SONG_ITEM, song: HYMN_ONE_ID},
        {id: HEADER_ITEM, header: '말씀'},
        {
          slides: [],
          id: MISSING_SONG_ITEM,
          song: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0',
        },
      ]),
    ].map(document => [document.id, document]),
  );
  return {
    serviceList: () => [...services.keys()].map(id => ({id})),
    service: id => {
      const found = services.get(id);
      return found === undefined ? null : {service: found};
    },
    song: id => (id === HYMN_ONE_ID ? {song: hymn} : null),
  };
}

/**
 * A recovery record of the given live state fields over the empty state, read
 * the way a launch reads it. Fields are plain JSON; the record parser checks
 * them.
 */
export function recoveryRecordOf(
  fields: object,
  serviceId: string | null = SERVICE,
): RecoveryRecord {
  const empty = emptyLiveState();
  const layers: unknown = Reflect.get(fields, 'layers');
  const state = {
    ...empty,
    ...fields,
    layers: {...empty.layers, ...(isRecord(layers) ? layers : {})},
  };
  return expectSuccess(parseRecoveryRecord(recoveryText(state, serviceId)))
    .data;
}

/** The text of `live.json` for a state. */
export function recoveryText(
  state: object,
  serviceId: string | null = SERVICE,
): string {
  return JSON.stringify({
    format: 'llrecovery',
    schemaVersion: 1,
    savedAt: SAVED_AT,
    serviceId,
    state,
  });
}
