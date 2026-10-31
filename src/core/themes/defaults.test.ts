import {expect, it} from 'vitest';
import {
  STARTER_LYRIC_STYLE,
  STARTER_STAGE_ELEMENTS,
} from '../looks/starterLayout';
import {STARTER_SCREEN_IDS} from '../screens/screens';
import {createScreenId} from '../schema/ids';
import {builtInTheme} from './defaults';

it('converts the starter audience styles and stage geometry into theme elements', () => {
  const main = createScreenId(STARTER_SCREEN_IDS.main);
  const broadcast = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const stage = createScreenId(STARTER_SCREEN_IDS.stage);
  const theme = builtInTheme('song');
  expect(theme.screens[main]).toMatchObject({
    mode: {kind: 'own'},
    elements: [
      {kind: 'background'},
      {kind: 'media'},
      {
        kind: 'currentText',
        text: {
          font: STARTER_LYRIC_STYLE.font,
          size: STARTER_LYRIC_STYLE.size,
          vAlign: 'middle',
        },
      },
    ],
  });
  expect(theme.screens[broadcast]).toMatchObject({
    background: '#00B140',
    elements: [
      {kind: 'background'},
      {kind: 'media'},
      {kind: 'currentText', text: {vAlign: 'bottom'}},
    ],
  });
  expect(theme.screens[stage]?.elements.map(element => element.frame)).toEqual(
    STARTER_STAGE_ELEMENTS.map(element => element.frame),
  );
  expect(theme.screens[stage]?.elements.map(element => element.kind)).toEqual([
    'label',
    'currentText',
    'clock',
    'timer',
    'nextLabel',
    'nextText',
    'stageMessage',
  ]);
});

it('adds a reference only for Bible layouts and adapts to configured screen IDs', () => {
  const id = createScreenId('00000000-0000-4000-8000-000000000999');
  const screens = [{id, kind: 'audience', method: 'fullscreen'}] as const;
  expect(Object.keys(builtInTheme('bible', screens).screens)).toEqual([id]);
  expect(
    builtInTheme('bible', screens).screens[id]?.elements.at(-1)?.kind,
  ).toBe('reference');
  expect(
    builtInTheme('song', screens).screens[id]?.elements.some(
      element => element.kind === 'reference',
    ),
  ).toBe(false);
});

it('reserves a separate bottom band for the capture Bible reference', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.broadcast);
  const bible = builtInTheme('bible').screens[id];
  const verse = bible?.elements.find(element => element.kind === 'currentText');
  const reference = bible?.elements.find(
    element => element.kind === 'reference',
  );
  const song = builtInTheme('song').screens[id]?.elements.find(
    element => element.kind === 'currentText',
  );
  if (verse === undefined || reference === undefined || song === undefined) {
    throw new Error('Expected the starter capture text elements');
  }
  expect(verse.text.vAlign).toBe('bottom');
  expect(verse.frame.y + verse.frame.h).toBeLessThan(reference.frame.y);
  expect(reference.frame.y + reference.frame.h).toBeCloseTo(
    song.frame.y + song.frame.h,
  );
  expect(reference.frame.x).toBe(verse.frame.x);
  expect(reference.frame.w).toBe(verse.frame.w);
});

it('keeps the stage Bible reference between the current and next text rows', () => {
  const id = createScreenId(STARTER_SCREEN_IDS.stage);
  const elements = builtInTheme('bible').screens[id]?.elements ?? [];
  const current = elements.find(element => element.kind === 'currentText');
  const reference = elements.find(element => element.kind === 'reference');
  const next = elements.find(element => element.kind === 'nextLabel');
  if (current === undefined || reference === undefined || next === undefined) {
    throw new Error('Expected the starter stage text elements');
  }
  expect(current.frame.y + current.frame.h).toBeLessThan(reference.frame.y);
  expect(reference.frame.y + reference.frame.h).toBeLessThan(next.frame.y);
});
