import {expect, it} from 'vitest';
import {builtInTheme} from '@core/themes/defaults';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {STAGE_BAR_GROUP_TOP_WITH_MESSAGE} from '@core/themes/starterLayout';
import {stageBarLayout} from '@renderer/rendering/stageBar';

it('centers the stage bar group until a message needs the lower row', () => {
  const layout =
    builtInTheme('song').screens[createScreenId(STARTER_SCREEN_IDS.stage)];
  if (!layout) throw Error('Missing stage layout');
  expect(stageBarLayout(layout, {stage: true, message: null})).toBe(layout);
  const withMessage = stageBarLayout(layout, {stage: true, message: 'Cue'});
  const label = withMessage.elements.find(element => element.kind === 'label');
  expect(label?.frame.y).toBe(STAGE_BAR_GROUP_TOP_WITH_MESSAGE);
  expect(
    withMessage.elements.find(element => element.kind === 'timer'),
  ).toEqual(layout.elements.find(element => element.kind === 'timer'));
  expect(
    withMessage.elements.find(element => element.kind === 'stageMessage'),
  ).toEqual(layout.elements.find(element => element.kind === 'stageMessage'));
  const {stageBar: _stageBar, ...saved} = layout;
  expect(stageBarLayout(saved, {stage: true, message: 'Cue'})).toBe(saved);
  expect(stageBarLayout(layout, {stage: false, message: 'Cue'})).toBe(layout);
});

it('fits the Bible reference in a centered stage frame', () => {
  const layout =
    builtInTheme('bible').screens[createScreenId(STARTER_SCREEN_IDS.stage)];
  if (!layout) throw Error('Missing stage layout');
  const item = {id: 'bible', kind: 'bible', source: 'service'} as const;
  const label = stageBarLayout(layout, {
    stage: true,
    message: null,
    item,
  }).elements.find(element => element.kind === 'label');
  expect(label).toMatchObject({
    frame: {x: 154, y: 26, w: 1612, h: 58},
    text: {size: 48, color: '#E6E6E6', align: 'center'},
  });
});
