import {afterEach, expect, it} from 'vitest';
import {isInPopoverOrDialog, layerContainer} from '@renderer/ui/popups/layers';

afterEach(() => {
  document.body.replaceChildren();
});

it('counts what is inside a popover or a dialog, not a tooltip or the app', () => {
  const inside = (layer: 'popover' | 'dialog' | 'tooltip') => {
    const element = document.createElement('button');
    layerContainer(layer).append(element);
    return element;
  };
  const app = document.createElement('div');
  document.body.append(app);

  expect(isInPopoverOrDialog(inside('popover'))).toBe(true);
  expect(isInPopoverOrDialog(inside('dialog'))).toBe(true);
  expect(isInPopoverOrDialog(inside('tooltip'))).toBe(false);
  expect(isInPopoverOrDialog(app)).toBe(false);
});
