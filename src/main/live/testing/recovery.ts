import {isRecord} from '@shared/guards';
import {emptyLiveState} from '@shared/live';
import {createServiceId, createServiceItemId} from '@shared/schema/ids';
import {
  parseRecoveryRecord,
  type RecoveryRecord,
} from '@shared/schema/recoveryRecord';
import {parseService} from '@shared/schema/service';
import {parseSong} from '@shared/schema/song';
import {expectSuccess} from '@shared/schema/testHelpers';
import type {RecoveryContent} from '../recovery/plan';
import {
  HYMN_ONE_ID,
  hymnOne,
  itemId,
  service,
  EVENING_ID,
  SUNDAY_ID,
} from '../../store/testFiles';

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
 * Two 예배 순서: the first has a song item (5 slides in its 구성), a header,
 * and a song that is gone; the second, listed first, has only a header.
 */
export function recoveryContent(): RecoveryContent {
  const services = new Map<string, ReturnType<typeof serviceOf>>(
    [
      serviceOf(EVENING_ID, [{id: itemId(104), header: '찬양'}]),
      serviceOf(SUNDAY_ID, [
        {id: SONG_ITEM, song: HYMN_ONE_ID, arrangement: '주일용'},
        {id: HEADER_ITEM, header: '말씀'},
        {id: MISSING_SONG_ITEM, song: 'f0f0f0f0-f0f0-4f0f-8f0f-f0f0f0f0f0f0'},
      ]),
    ].map(document => [document.id, document]),
  );
  const hymn = expectSuccess(
    parseSong(JSON.stringify(hymnOne()), 'hymn.llsong'),
  ).data;
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
