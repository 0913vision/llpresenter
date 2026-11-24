import {settingsDocument} from '@fixtures/core/settingsDocument';
import {describe, expect, it} from 'vitest';
import {messageBlankNames} from '@core/overlays/messageText';
import {
  currentMessageTargets,
  prepareMessage,
  toggleMessageScreen,
} from '@core/overlays/messageDraft';
import {createScreenId} from '@core/schema/common/ids';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from '@fixtures/core/screenDocuments';

const document = settingsDocument('messages', {
  templates: [
    {
      id: '00000000-0000-4000-8000-000000000021',
      name: 'Test',
      icon: 'msg',
      text: '{value}',
    },
  ],
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

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

describe('toggleMessageScreen', () => {
  const main = createScreenId(MAIN_ID);
  const stage = createScreenId(STAGE_ID);

  it('leaves only the screen chosen when the message went to every screen', () => {
    expect(toggleMessageScreen('all', stage)).toEqual([stage]);
  });

  it('adds a screen not chosen yet and removes one that was', () => {
    expect(toggleMessageScreen([main], stage)).toEqual([main, stage]);
    expect(toggleMessageScreen([main, stage], main)).toEqual([stage]);
  });
});

describe('currentMessageTargets', () => {
  it('drops repeats and screens that are gone, and keeps every screen as it is', () => {
    const gone = createScreenId('00000000-0000-4000-8000-000000000099');
    const captions = createScreenId(CAPTIONS_ID);

    expect(
      currentMessageTargets([captions, gone, captions], screens()),
    ).toEqual([captions]);
    expect(currentMessageTargets('all', screens())).toBe('all');
  });
});
