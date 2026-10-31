import {settingsDocument} from '@core/testing/settingsDocument';
import {expect, it} from 'vitest';
import {messageBlankNames} from '@core/overlays/messageText';
import {prepareMessage} from '@core/overlays/messageDraft';

const document = settingsDocument('messages', {
  templates: [
    {
      id: '00000000-0000-4000-8000-000000000021',
      name: 'Test',
      icon: 'msg',
      text: '{value}',
    },
  ],
  stagePresets: [],
});
if (document.name !== 'messages' || document.value.templates[0] === undefined) {
  throw new Error('Invalid message fixture');
}
const template = document.value.templates[0];

it('extracts exact unique blank names with the same grammar as macro rendering', () => {
  expect(
    messageBlankNames('{value}, {value}, {}, { name }, {__proto__}'),
  ).toEqual(['value', ' name ', '__proto__']);
  expect(messageBlankNames(`${'x'.repeat(4000)}{value}`)).toEqual([]);
  expect(messageBlankNames('{a}'.repeat(1333))).toEqual(['a']);
});

it('blocks empty targets and the live command cap while accepting the boundary', () => {
  const draft = {
    template,
    values: new Map([['value', 'Hello']]),
    targets: 'all' as const,
  };
  expect(prepareMessage({...draft, screenCount: 0}).reason).toBeDefined();
  expect(prepareMessage({...draft, screenCount: 201}).reason).toBeDefined();
  expect(prepareMessage({...draft, screenCount: 200})).toEqual({
    text: 'Hello',
    reason: undefined,
  });
  expect(
    prepareMessage({...draft, targets: [], screenCount: 3}).reason,
  ).toBeDefined();
});
