import {expect, it} from 'vitest';
import {DEFAULT_MESSAGE_STYLE} from '@shared/schema/looks';
const DEFAULT_LYRIC_STYLE = {
  ...DEFAULT_MESSAGE_STYLE,
  referencePosition: 'bottomRight' as const,
};
import {
  looksDocument,
  screensDocument,
  settingsDocument,
} from '../testing/documents';
import {editLookCard, screenCard} from './lookCardEdits';

function fixture() {
  const initial = looksDocument();
  const screens = screensDocument();
  if (initial.name !== 'looks' || screens.name !== 'screens') {
    throw new Error('Wrong document');
  }
  const styles = settingsDocument('looks', {
    ...initial.value,
    lyricStyles: [
      {
        ...DEFAULT_LYRIC_STYLE,
        id: '00000000-0000-4000-8000-0000000000d1',
        name: '기본',
      },
    ],
  });
  if (styles.name !== 'looks') throw new Error('Wrong styles document');
  const look = styles.value.looks[0];
  const screen = screens.value.screens[0];
  const style = styles.value.lyricStyles[0];
  if (look === undefined || screen === undefined || style === undefined) {
    throw new Error('Missing fixture');
  }
  return {file: styles.value, look, screen, style};
}

it('preserves effective visibility when creating a missing screen card', () => {
  const {file, look, screen} = fixture();
  expect(screenCard(look, screen.id).layers.slide).toBe(true);
  const next = editLookCard(file, {
    lookId: look.id,
    screenId: screen.id,
    change: {kind: 'layer', layer: 'media', on: false},
  });
  expect(next.looks[0]?.screens[screen.id]?.layers).toEqual({
    media: false,
    slide: true,
    notice: true,
    prop: true,
    message: true,
    clock: true,
    stageMessage: true,
  });
  expect(next.looks[1]).toBe(file.looks[1]);
  expect(next.current).toBe(file.current);
  expect(look.screens[screen.id]).toBeUndefined();
});

it('merges axis-independent card edits and keeps unknown fields at every level', () => {
  const {file, look, screen, style} = fixture();
  const before = {
    ...file,
    futureFile: 1,
    looks: [
      {
        ...look,
        futureLook: 2,
        screens: {
          ...look.screens,
          [screen.id]: {
            futureCard: 3,
            layers: {media: false, futureLayer: true},
            background: {
              kind: 'color' as const,
              color: '#00B140',
              futureBackground: 4,
            },
          },
        },
      },
      ...file.looks.slice(1),
    ],
  };
  const first = editLookCard(before, {
    lookId: look.id,
    screenId: screen.id,
    change: {kind: 'lyricStyle', id: style.id},
  });
  const next = editLookCard(first, {
    lookId: look.id,
    screenId: screen.id,
    change: {kind: 'background', value: {kind: 'media'}},
  });
  expect(next).toHaveProperty('futureFile', 1);
  expect(next.looks[0]).toHaveProperty('futureLook', 2);
  expect(next.looks[0]?.screens[screen.id]).toMatchObject({
    futureCard: 3,
    lyricStyle: style.id,
    layers: {media: false, futureLayer: true},
    background: {kind: 'media', futureBackground: 4},
  });
  const removed = editLookCard(next, {
    lookId: look.id,
    screenId: screen.id,
    change: {kind: 'lyricStyle', id: null},
  });
  expect(removed.looks[0]?.screens[screen.id]).not.toHaveProperty('lyricStyle');
  expect(removed.looks[0]?.screens[screen.id]?.layers).toBe(
    next.looks[0]?.screens[screen.id]?.layers,
  );
});

it('ignores missing Looks and missing style references without creating orphan data', () => {
  const {file, screen, style} = fixture();
  const missing = {...file, looks: []};
  expect(
    editLookCard(missing, {
      lookId: file.current,
      screenId: screen.id,
      change: {kind: 'layer', layer: 'slide', on: true},
    }),
  ).toBe(missing);
  const withoutStyles = {...file, lyricStyles: []};
  expect(
    editLookCard(withoutStyles, {
      lookId: file.current,
      screenId: screen.id,
      change: {kind: 'lyricStyle', id: style.id},
    }),
  ).toBe(withoutStyles);
});

it('changes and clears a stage layout without touching other card fields', () => {
  const {file, look} = fixture();
  const entry = Object.entries(look.screens)[0];
  if (entry?.[1].stageLayout === undefined) {
    throw new Error('Missing stage card');
  }
  const screens = screensDocument();
  if (screens.name !== 'screens') throw new Error('Wrong screens document');
  const stage = screens.value.screens.find(screen => screen.kind === 'stage');
  if (stage === undefined) throw new Error('Missing stage screen');
  const next = editLookCard(file, {
    lookId: look.id,
    screenId: stage.id,
    change: {kind: 'stageLayout', id: null},
  });
  expect(next.looks[0]?.screens[stage.id]).not.toHaveProperty('stageLayout');
  const restored = editLookCard(next, {
    lookId: look.id,
    screenId: stage.id,
    change: {kind: 'stageLayout', id: entry[1].stageLayout},
  });
  expect(restored.looks[0]?.screens[stage.id]).toEqual(entry[1]);
});
