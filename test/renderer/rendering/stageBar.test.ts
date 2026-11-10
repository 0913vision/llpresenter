import {expect, it} from 'vitest';
import {builtInTheme} from '@core/themes/defaults';
import {createScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {stageBarLayout} from '@renderer/rendering/stageBar';

it('centers the stage bar group until a message needs the lower row', () => {
  const layout =
    builtInTheme('song').screens[createScreenId(STARTER_SCREEN_IDS.stage)];
  if (!layout) throw Error('Missing stage layout');
  expect(stageBarLayout(layout, true, null)).toBe(layout);
  const withMessage = stageBarLayout(layout, true, 'Cue');
  for (const kind of ['label', 'text'] as const) {
    const group = withMessage.elements.filter(
      element =>
        element.kind === kind &&
        (element.kind !== 'text' || element.stageSource !== undefined),
    );
    expect(group.length).toBeGreaterThan(0);
    for (const element of group) expect(element.frame.y).toBe(2);
  }
  expect(
    withMessage.elements.find(element => element.kind === 'timer'),
  ).toEqual(layout.elements.find(element => element.kind === 'timer'));
  expect(
    withMessage.elements.find(element => element.kind === 'stageMessage'),
  ).toEqual(layout.elements.find(element => element.kind === 'stageMessage'));
  const {stageBar: _stageBar, ...saved} = layout;
  expect(stageBarLayout(saved, true, 'Cue')).toBe(saved);
  expect(stageBarLayout(layout, false, 'Cue')).toBe(layout);
});
