import {expect, it} from 'vitest';
import {commandPressAction} from './precedence';
import type {PhysicalKeyPress} from './matching';

const event: PhysicalKeyPress = {
  code: 'F8',
  ctrlKey: false,
  altKey: false,
  shiftKey: false,
  metaKey: false,
  isComposing: false,
  repeat: false,
  getModifierState: () => false,
};
const press = {
  event,
  priority: 'normal',
  focus: 'global',
  composing: false,
  repeat: false,
  textHistoryOwner: false,
  textAllowed: true,
  live: true,
  workspace: 'show',
} as const;

it('lets only physical F1 through F7 clear during composition', () => {
  expect(
    commandPressAction({
      ...press,
      event: {...event, code: 'F1', isComposing: true},
      priority: 'clear',
      focus: 'text',
    }),
  ).toBe('run');
  expect(
    commandPressAction({...press, composing: true, priority: 'clear'}),
  ).toBe('pass');
  expect(
    commandPressAction({...press, composing: true, priority: 'zoom'}),
  ).toBe('pass');
  expect(commandPressAction({...press, composing: true})).toBe('pass');
});

it('gives the recorder precedence over clear and zoom regardless of remapping', () => {
  for (const priority of ['clear', 'zoom', 'normal'] as const) {
    expect(commandPressAction({...press, priority, focus: 'recording'})).toBe(
      'pass',
    );
  }
});

it('keeps surface keys local while passing clears and zoom', () => {
  expect(commandPressAction({...press, focus: 'surface'})).toBe('pass');
  expect(
    commandPressAction({...press, focus: 'surface', priority: 'clear'}),
  ).toBe('run');
  expect(
    commandPressAction({...press, focus: 'surface', priority: 'zoom'}),
  ).toBe('run');
});

it('leaves text editing native and prevents clear undo even with a modifier', () => {
  const modified = {...event, code: 'KeyK', ctrlKey: true};
  expect(commandPressAction({...press, focus: 'text', event: modified})).toBe(
    'run',
  );
  expect(
    commandPressAction({
      ...press,
      focus: 'text',
      event: modified,
      textAllowed: false,
    }),
  ).toBe('pass');
  expect(
    commandPressAction({
      ...press,
      focus: 'text',
      event: {...event, code: 'KeyZ', ctrlKey: true},
    }),
  ).toBe('pass');
  expect(
    commandPressAction({
      ...press,
      focus: 'text',
      textHistoryOwner: true,
      event: {...event, code: 'KeyZ', ctrlKey: true},
    }),
  ).toBe('run');
  expect(commandPressAction({...press, focus: 'text'})).toBe('pass');
});

it('swallows repeats for live commands and permits repeating navigation and editing', () => {
  expect(commandPressAction({...press, event: {...event, repeat: true}})).toBe(
    'consume',
  );
  expect(
    commandPressAction({
      ...press,
      event: {...event, repeat: true},
      repeat: true,
    }),
  ).toBe('run');
});

it('protects focused controls and permits only modified live commands in prep', () => {
  expect(commandPressAction({...press, focus: 'control'})).toBe('pass');
  expect(commandPressAction({...press, workspace: 'prep'})).toBe('pass');
  expect(
    commandPressAction({
      ...press,
      workspace: 'prep',
      event: {...event, ctrlKey: true},
    }),
  ).toBe('run');
  expect(commandPressAction({...press, workspace: 'prep', live: false})).toBe(
    'run',
  );
});
