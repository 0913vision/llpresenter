import {describe, expect, it} from 'vitest';
import {emptyLiveState, layerKinds} from '@core/live/state';
import {parseLiveState} from '@core/schema/liveState';
import {parseLiveCommand} from '@core/schema/liveCommand';
import {
  MAX_ACTIVE_MESSAGES,
  MAX_ACTIVE_PROPS,
  MAX_NOTICE_IMAGES,
  MAX_TARGET_SCREENS,
} from '@core/schema/overlayState';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const NOW = 1_700_000_000_000;
const message = (index = 1) => ({
  messageId: uuid(index),
  text: 'Invented announcement',
  targets: 'all',
  excludedTargets: [],
  startedAt: NOW,
  expiresAt: NOW + 30_000,
});
const prop = (index = 1) => ({
  propId: uuid(index),
  content: {kind: 'image', media: uuid(3)},
  targets: [uuid(4)],
});
const playback = () => ({
  media: [uuid(3), uuid(4)],
  position: 1,
  interval: 5,
  loop: true,
  targets: [uuid(5)],
  startedAt: NOW,
  pausedAt: null,
});
function state(layers: object = {}, addition: object = {}) {
  const empty = emptyLiveState();
  return {...empty, layers: {...empty.layers, ...layers}, ...addition};
}
function messageState(items: readonly unknown[]) {
  return state({message: {messageId: 'legacy-message', text: '', items}});
}
function propState(items: readonly unknown[]) {
  return state({prop: {propId: 'legacy-prop', items}});
}
function noticeState(value: unknown) {
  return state({notice: {noticeId: 'legacy-notice', playback: value}});
}

describe('additive overlay state contracts', () => {
  it('validates text prop content with the stored prop style schema', () => {
    const content = {
      kind: 'text',
      text: 'Invented prop cue',
      style: {
        font: 'Pretendard',
        weight: 600,
        color: '#FFFFFF',
        size: 64,
        lineHeight: 1.2,
        align: 'center',
        vAlign: 'bottom',
        maxLines: 1,
        margin: 4,
        shadow: true,
        outline: false,
      },
    };
    expect(parseLiveState(propState([{...prop(), content}])).ok).toBe(true);
    expect(
      parseLiveState(
        propState([
          {
            ...prop(),
            content: {...content, style: {...content.style, font: 5}},
          },
        ]),
      ).ok,
    ).toBe(false);
  });

  it('round-trips per-screen messages, concurrent props, notice playback, and a separate stage message', () => {
    const value = state(
      {
        message: {
          messageId: 'summary',
          text: 'Second',
          items: [
            {...message(), excludedTargets: [uuid(4)]},
            {...message(2), targets: [uuid(4)], expiresAt: null},
          ],
        },
        prop: {propId: 'summary', items: [prop(), prop(2)]},
        notice: {
          noticeId: 'summary',
          playback: {...playback(), pausedAt: NOW + 2_000},
        },
      },
      {stageMessage: 'Invented stage cue'},
    );
    expect(
      expectSuccess(parseLiveState(JSON.parse(JSON.stringify(value)))),
    ).toEqual(value);
    expect(layerKinds).not.toContain('stageMessage');
    expect(
      expectSuccess(parseLiveState(state({}, {stageMessage: null}))),
    ).toHaveProperty('stageMessage', null);
    expect(parseLiveState(state({}, {stageMessage: 4})).ok).toBe(false);
    expect(parseLiveState(state({}, {stageMessage: ''})).ok).toBe(false);
    expect(parseLiveState(state({}, {stageMessage: ' \n\t'})).ok).toBe(false);
    expect(parseLiveState(propState([{...prop(), targets: []}])).ok).toBe(true);
  });

  it.each([
    ['an invalid message id', {...message(), messageId: 'legacy-id'}],
    ['an invalid screen id', {...message(), targets: ['main']}],
    ['empty explicit targets', {...message(), targets: []}],
    ['duplicate targets', {...message(), targets: [uuid(4), uuid(4)]}],
    [
      'duplicate exclusions',
      {...message(), excludedTargets: [uuid(4), uuid(4)]},
    ],
    [
      'exclusions outside explicit targets',
      {...message(), targets: [uuid(4)], excludedTargets: [uuid(5)]},
    ],
    ['expiry before start', {...message(), expiresAt: NOW - 1}],
    ['a negative start', {...message(), startedAt: -1}],
    ['an infinite expiry', {...message(), expiresAt: Infinity}],
    ['an unsafe clock', {...message(), expiresAt: Number.MAX_SAFE_INTEGER + 1}],
    ['missing routing metadata', {...message(), excludedTargets: undefined}],
  ])('rejects %s', (_name, item) => {
    expect(parseLiveState(messageState([item])).ok).toBe(false);
  });

  it('rejects duplicate active identities and invalid prop payloads', () => {
    expect(parseLiveState(messageState([message(), message()])).ok).toBe(false);
    expect(parseLiveState(propState([prop(), prop()])).ok).toBe(false);
    expect(parseLiveState(propState([{...prop(), propId: 'bad'}])).ok).toBe(
      false,
    );
    expect(
      parseLiveState(
        propState([{...prop(), content: {kind: 'image', media: 'bad'}}]),
      ).ok,
    ).toBe(false);
    expect(
      parseLiveState(propState([{...prop(), targets: [uuid(1), uuid(1)]}])).ok,
    ).toBe(false);
  });

  it.each([
    ['empty images', {...playback(), media: []}],
    ['an invalid media id', {...playback(), media: ['bad']}],
    ['an out-of-range position', {...playback(), position: 2}],
    ['a fractional position', {...playback(), position: 0.5}],
    ['a zero interval', {...playback(), interval: 0}],
    ['a pause before start', {...playback(), pausedAt: NOW - 1}],
    ['an invalid target', {...playback(), targets: ['stage']}],
    ['no target screens', {...playback(), targets: []}],
    ['an invalid gone id', {...playback(), gone: ['bad']}],
    [
      'too many gone ids',
      {
        ...playback(),
        gone: Array.from({length: MAX_NOTICE_IMAGES + 1}, () => uuid(3)),
      },
    ],
  ])('rejects notice playback with %s', (_name, value) => {
    expect(parseLiveState(noticeState(value)).ok).toBe(false);
  });

  it('accepts the ids that left the library, up to the image cap', () => {
    expect(
      parseLiveState(noticeState({...playback(), gone: [uuid(3)]})).ok,
    ).toBe(true);
    expect(
      parseLiveState(
        noticeState({
          ...playback(),
          gone: Array.from({length: MAX_NOTICE_IMAGES}, () => uuid(3)),
        }),
      ).ok,
    ).toBe(true);
  });

  it('accepts each list at its cap and rejects the next item', () => {
    const messages = Array.from(
      {length: MAX_ACTIVE_MESSAGES},
      (_value, index) => message(index + 1),
    );
    expect(parseLiveState(messageState(messages)).ok).toBe(true);
    expect(
      parseLiveState(
        messageState([...messages, message(MAX_ACTIVE_MESSAGES + 1)]),
      ).ok,
    ).toBe(false);
    const props = Array.from({length: MAX_ACTIVE_PROPS}, (_value, index) =>
      prop(index + 1),
    );
    expect(parseLiveState(propState(props)).ok).toBe(true);
    expect(
      parseLiveState(propState([...props, prop(MAX_ACTIVE_PROPS + 1)])).ok,
    ).toBe(false);
    const images = Array.from({length: MAX_NOTICE_IMAGES}, () => uuid(3));
    expect(parseLiveState(noticeState({...playback(), media: images})).ok).toBe(
      true,
    );
    expect(
      parseLiveState(noticeState({...playback(), media: [...images, uuid(3)]}))
        .ok,
    ).toBe(false);
    const screens = Array.from({length: MAX_TARGET_SCREENS}, (_value, index) =>
      uuid(index + 1),
    );
    for (const value of [
      (targets: readonly string[]) => messageState([{...message(), targets}]),
      (excludedTargets: readonly string[]) =>
        messageState([{...message(), excludedTargets}]),
      (targets: readonly string[]) => propState([{...prop(), targets}]),
      (targets: readonly string[]) => noticeState({...playback(), targets}),
    ]) {
      expect(parseLiveState(value(screens)).ok).toBe(true);
      expect(
        parseLiveState(value([...screens, uuid(MAX_TARGET_SCREENS + 1)])).ok,
      ).toBe(false);
    }
  });
});

describe('message.expire contract', () => {
  it.each([
    {type: 'message.expire', messageId: 'bad', expiresAt: NOW},
    {type: 'message.expire', messageId: uuid(1)},
    {type: 'message.expire', messageId: uuid(1), expiresAt: -1},
    {type: 'message.expire', messageId: uuid(1), expiresAt: Infinity},
  ])('rejects invalid expiry metadata %#', command => {
    expect(parseLiveCommand(command).ok).toBe(false);
  });
});
