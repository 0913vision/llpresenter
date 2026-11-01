import {expect, it, vi} from 'vitest';
import {
  WINDOW_BOUNDS,
  mockControl,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {forwardOutputKeys} from '@main/outputs/outputKeys';

const stopForwarding = vi.hoisted(() => vi.fn());
vi.mock('@main/outputs/outputKeys', () => ({
  forwardOutputKeys: vi.fn(() => stopForwarding),
}));

it('forwards its keys to the control window without focusing or raising it, and stops on destroy', () => {
  const control = mockControl();
  const output = openOutput('normal', control);
  const win = lastWindow();
  output.showWindowed(WINDOW_BOUNDS);
  output.bringToFront();

  expect(forwardOutputKeys).toHaveBeenCalledWith(
    win.webContents,
    control,
    expect.anything(),
  );
  expect(control.focus).not.toHaveBeenCalled();
  expect(control.moveAbove).not.toHaveBeenCalled();
  output.destroy();
  expect(stopForwarding).toHaveBeenCalledOnce();
});
