import {expect, it} from 'vitest';
import {themeScreenOrder} from './screenOrder';

it('puts capture canvases after stage screens and preserves configured order within each role', () => {
  const screens = [
    {name: 'Capture', kind: 'audience', method: 'capture'},
    {name: 'Stage', kind: 'stage', method: 'fullscreen'},
    {name: 'Main', kind: 'audience', method: 'fullscreen'},
    {name: 'Side', kind: 'audience', method: 'window'},
  ] as const;
  expect(themeScreenOrder(screens).map(screen => screen.name)).toEqual([
    'Main',
    'Side',
    'Stage',
    'Capture',
  ]);
  expect(screens[0].name).toBe('Capture');
});
