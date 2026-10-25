import {describe, expect, it} from 'vitest';
import {parseServiceItemId, type ServiceItemId} from './ids';
import {isKeyCode} from './shortcuts';
import {
  parseActiveMessages,
  parseActiveProps,
  parseNoticePlayback,
  MAX_ACTIVE_MESSAGES,
  MAX_ACTIVE_PROPS,
  MAX_NOTICE_IMAGES,
  MAX_TARGET_SCREENS,
} from './overlayState';
import {expectSuccess} from './testHelpers';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const message = (index = 1) => ({
  messageId: uuid(index),
  text: 'Invented message',
  targets: 'all',
  excludedTargets: [],
  startedAt: 1000,
  expiresAt: null,
});
const prop = (index = 1) => ({
  propId: uuid(index),
  content: {kind: 'image', media: uuid(2)},
  targets: [],
});
const playback = () => ({
  media: [uuid(2), uuid(3)],
  position: 0,
  interval: 5,
  loop: true,
  targets: [uuid(4)],
  startedAt: 1000,
  pausedAt: null,
});

describe('public overlay parse helpers', () => {
  it('returns normalized values for valid and empty active lists and notice playback', () => {
    expect(expectSuccess(parseActiveMessages([]))).toEqual([]);
    expect(expectSuccess(parseActiveProps([]))).toEqual([]);
    expect(expectSuccess(parseActiveMessages([message()]))).toEqual([
      message(),
    ]);
    expect(expectSuccess(parseActiveProps([prop()]))).toEqual([prop()]);
    expect(expectSuccess(parseNoticePlayback(playback()))).toEqual(playback());
    expect(
      expectSuccess(parseActiveMessages([{...message(), ignored: true}])),
    ).toEqual([message()]);
  });

  it('returns field errors for malformed lists and playback without throwing', () => {
    for (const value of [null, {}, 'bad', [3]]) {
      expect(parseActiveMessages(value).ok).toBe(false);
      expect(parseActiveProps(value).ok).toBe(false);
    }
    for (const value of [
      null,
      [],
      {...playback(), position: 2},
      {...playback(), targets: []},
      {...playback(), pausedAt: 999},
    ]) {
      expect(parseNoticePlayback(value).ok).toBe(false);
    }
    const invalidMessage = parseActiveMessages([{...message(), startedAt: -1}]);
    const invalidProp = parseActiveProps([{...prop(), propId: 'bad'}]);
    expect(invalidMessage.ok ? null : invalidMessage.error.field).toBe(
      '0.startedAt',
    );
    expect(invalidProp.ok ? null : invalidProp.error.field).toBe('0.propId');
    expect(parseActiveMessages([message(), message()]).ok).toBe(false);
    expect(parseActiveProps([prop(), prop()]).ok).toBe(false);
  });

  it('retains the existing caps on public parser calls', () => {
    const messages = Array.from(
      {length: MAX_ACTIVE_MESSAGES},
      (_value, index) => message(index + 1),
    );
    const props = Array.from({length: MAX_ACTIVE_PROPS}, (_value, index) =>
      prop(index + 1),
    );
    const media = Array.from({length: MAX_NOTICE_IMAGES}, () => uuid(2));
    expect(parseActiveMessages(messages).ok).toBe(true);
    expect(
      parseActiveMessages([...messages, message(MAX_ACTIVE_MESSAGES + 1)]).ok,
    ).toBe(false);
    expect(parseActiveProps(props).ok).toBe(true);
    expect(parseActiveProps([...props, prop(MAX_ACTIVE_PROPS + 1)]).ok).toBe(
      false,
    );
    expect(parseNoticePlayback({...playback(), media}).ok).toBe(true);
    expect(
      parseNoticePlayback({...playback(), media: [...media, uuid(2)]}).ok,
    ).toBe(false);
    expect(
      parseNoticePlayback({
        ...playback(),
        targets: Array.from({length: MAX_TARGET_SCREENS + 1}, (_value, index) =>
          uuid(index + 1),
        ),
      }).ok,
    ).toBe(false);
  });
});

describe('service item ID parsing', () => {
  it('returns a branded ID without a throwing cast or factory', () => {
    const value: ServiceItemId = expectSuccess(parseServiceItemId(uuid(1)));
    expect(value).toBe(uuid(1));
  });
  it.each([
    null,
    undefined,
    3,
    [],
    {},
    '',
    'legacy-item',
    '6F1C2A9E-4B7D-4C1A-9E2F-0123456789AB',
    '00000000-0000-1000-8000-000000000001',
  ])('rejects an invalid item ID %#', value => {
    expect(parseServiceItemId(value).ok).toBe(false);
  });
});

describe('physical key-code recognition', () => {
  it.each(['KeyA', 'Digit4', 'ArrowLeft', 'F1', 'NumpadEnter', 'PrintScreen'])(
    'accepts %s',
    code => {
      expect(isKeyCode(code)).toBe(true);
    },
  );
  it.each([
    null,
    undefined,
    3,
    {},
    '',
    'a',
    'Ctrl+A',
    'KeyAA',
    'F25',
    'Unidentified',
    'ControlLeft',
  ])('rejects an unsupported key code %#', code => {
    expect(isKeyCode(code)).toBe(false);
  });
});
