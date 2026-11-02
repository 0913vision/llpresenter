import {expect, it} from 'vitest';
import {themeScreenOrder} from '@core/themes/screenOrder';

it('puts broadcast canvases before stage screens and preserves configured order within each role', () => {
  const screens = [
    {name: 'Capture', kind: 'broadcast', method: 'capture'},
    {name: 'Stage', kind: 'stage', method: 'fullscreen'},
    {name: 'Main', kind: 'audience', method: 'fullscreen'},
    {name: 'Side', kind: 'audience', method: 'window'},
  ] as const;
  expect(themeScreenOrder(screens).map(screen => screen.name)).toEqual([
    'Main',
    'Side',
    'Capture',
    'Stage',
  ]);
  expect(screens[0].name).toBe('Capture');
});
