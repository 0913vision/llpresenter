import {describe, it} from 'vitest';
import {parseNotices, serializeNotices} from './notices';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseNotices, serialize: serializeNotices};
const SUNDAY_NOTICES = '5c2e9a10-1b2c-4d3e-9f40-5a6b7c8d9e0f';
const MAIN_SCREEN = '11111111-1111-4111-8111-111111111111';
const IMAGES = [
  '8a8b8c8d-1e2f-4a3b-9c4d-5e6f7a8b9c01',
  '8a8b8c8d-1e2f-4a3b-9c4d-5e6f7a8b9c02',
];

function sundayNotices() {
  return {
    id: SUNDAY_NOTICES,
    name: '주일 광고',
    media: IMAGES,
    interval: 8,
    loop: true,
    targets: [MAIN_SCREEN],
  };
}

function noticesFile(sets: readonly object[]) {
  return {format: 'llsettings.notices', schemaVersion: 1, sets};
}

describe('parseNotices', () => {
  it('reads a 공지 set', () => {
    expectRoundTrip(codec, noticesFile([sundayNotices()]));
  });

  it('keeps unknown fields in a set', () => {
    expectRoundTrip(
      codec,
      noticesFile([{...sundayNotices(), transition: 'fade'}]),
    );
  });

  it.each([
    ['an interval of 0', {interval: 0}, 'sets.0.interval'],
    ['an image path', {media: ['공지/1.png']}, 'sets.0.media.0'],
    ['no target list', {targets: 'all'}, 'sets.0.targets'],
    ['a loop that is text', {loop: 'yes'}, 'sets.0.loop'],
  ])('rejects a set with %s', (_name, change, field) => {
    expectInvalidField(
      codec,
      noticesFile([{...sundayNotices(), ...change}]),
      field,
    );
  });
});
