import {expect, it} from 'vitest';
import {emptyLiveState} from '@shared/live';
import {
  looksDocument,
  screensDocument,
  stageLayoutsDocument,
} from '../testing/documents';
import {lookPreviewFrame} from './lookPreviewFrame';

function fixture() {
  const looks = looksDocument();
  const screens = screensDocument();
  const layouts = stageLayoutsDocument();
  if (
    looks.name !== 'looks' ||
    screens.name !== 'screens' ||
    layouts.name !== 'stage-layouts'
  ) {
    throw new Error('Wrong documents');
  }
  const selected = looks.value.looks[1];
  const stage = screens.value.screens.find(screen => screen.kind === 'stage');
  if (selected === undefined || stage === undefined) {
    throw new Error('Missing fixture');
  }
  return {
    looks: looks.value,
    selected,
    screen: stage,
    stageLayouts: layouts.value.layouts,
  };
}

it('resolves the selected Look while ignoring live Look and output-only overrides', () => {
  const input = fixture();
  const original = input.stageLayouts[0];
  if (original === undefined) throw new Error('Missing layout');
  const state = {
    ...emptyLiveState(),
    lookId: input.looks.current,
    testPatterns: [input.screen.id],
    stageLayouts: {[input.screen.id]: original.id},
    stageMessage: '진행',
  };
  const frame = lookPreviewFrame({...input, lookId: input.selected.id, state});
  expect(frame.look?.layers).toBe(
    input.selected.screens[input.screen.id]?.layers,
  );
  expect(frame.stage?.layout.id).toBe(
    input.selected.screens[input.screen.id]?.stageLayout,
  );
  expect(frame.stage?.layout.id).not.toBe(original.id);
  expect(frame.testPattern).toBeUndefined();
  expect(frame.stageMessage).toBe('진행');
  expect(state.lookId).toBe(input.looks.current);
});

it('keeps picture correction and handles missing layout references safely', () => {
  const input = fixture();
  const screen = {...input.screen, edgeMargin: 5, offset: {x: 10, y: -20}};
  const frame = lookPreviewFrame({
    ...input,
    screen,
    stageLayouts: [],
    lookId: input.selected.id,
    state: null,
  });
  expect(frame.screen?.correction).toEqual({
    edgeMargin: 5,
    offset: {x: 10, y: -20},
  });
  expect(frame.stage).toBeUndefined();
  expect(frame.look?.stageLayout).toBeDefined();
  expect(frame.stageMessage).toBeNull();
});
