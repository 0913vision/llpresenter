import {describe, expectTypeOf, it} from 'vitest';
import type {ScreenId} from './ids';
import {
  parseMessages,
  serializeMessages,
  type MessageTemplate,
} from './messages';
import {expectInvalidField, expectRoundTrip} from './testHelpers';

const codec = {parse: parseMessages, serialize: serializeMessages};
const CAR = 'f1f2f3f4-1111-4222-8333-444455556666';
const NURSERY = 'f1f2f3f4-2222-4222-8333-444455556666';
const MAIN_SCREEN = '11111111-1111-4111-8111-111111111111';

function carTemplate() {
  return {
    id: CAR,
    name: '차량 이동',
    icon: 'msg',
    text: '{차량 번호} 차량 이동 부탁드립니다',
    targets: 'all',
    duration: null,
  };
}

function messagesFile() {
  return {
    format: 'llsettings.messages',
    schemaVersion: 1,
    templates: [
      carTemplate(),
      {
        id: NURSERY,
        name: '영아부 호출',
        icon: 'user',
        text: '{이름} 부모님은 영아부로 와 주세요',
        targets: [MAIN_SCREEN],
        duration: 30,
      },
    ],
    stagePresets: ['후렴 한 번 더', '마지막 후렴'],
  };
}

describe('parseMessages', () => {
  it('reads the templates and the stage presets', () => {
    expectRoundTrip(codec, messagesFile());
  });

  it('reads a template without default targets or time', () => {
    const {targets: _targets, duration: _duration, ...template} = carTemplate();

    expectRoundTrip(codec, {...messagesFile(), templates: [template]});
  });

  it.each([
    ['an unknown icon', {icon: 'car'}, 'templates.0.icon'],
    [
      'targets of one screen id as text',
      {targets: MAIN_SCREEN},
      'templates.0.targets',
    ],
    ['a negative time', {duration: -5}, 'templates.0.duration'],
  ])('rejects a template with %s', (_name, change, field) => {
    expectInvalidField(
      codec,
      {...messagesFile(), templates: [{...carTemplate(), ...change}]},
      field,
    );
  });

  it('rejects a stage preset that is not text', () => {
    expectInvalidField(
      codec,
      {...messagesFile(), stagePresets: ['후렴', 3]},
      'stagePresets.1',
    );
  });
});

describe('message types', () => {
  it('allows every screen or a list of screens', () => {
    expectTypeOf<MessageTemplate['targets']>().toEqualTypeOf<
      readonly ScreenId[] | 'all' | undefined
    >();
  });
});
