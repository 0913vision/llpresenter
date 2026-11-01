import {
  MONITOR,
  openOutput,
  lastWindow,
} from '@fixtures/main/outputs/electronWindowFixtures';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const keeper = vi.hoisted(() => ({calls: new Array<string>()}));

vi.mock('@main/outputs/onTopKeeper', () => ({
  OnTopKeeper: class {
    readonly set = (onTop: boolean) => keeper.calls.push(`set:${onTop}`);
    readonly release = () => keeper.calls.push('release');
    readonly dispose = () => keeper.calls.push('dispose');
  },
}));

beforeEach(() => {
  keeper.calls.length = 0;
});

describe('createElectronOutputWindow always on top', () => {
  it('lets the keeper go before moving into full screen and sets the level after', () => {
    const output = openOutput('normal');
    const win = lastWindow();
    win.setFullScreen.mockImplementation((flag: boolean) =>
      keeper.calls.push(`fullscreen:${flag}`),
    );

    output.showFullScreen(MONITOR, true);

    expect(keeper.calls).toEqual(['release', 'fullscreen:true', 'set:true']);
  });

  it('lets the keeper go when hidden and disposes it with the window', () => {
    const output = openOutput('normal');
    output.showFullScreen(MONITOR, true);
    keeper.calls.length = 0;

    output.hide();
    expect(keeper.calls).toEqual(['release']);
    output.destroy();
    expect(keeper.calls).toEqual(['release', 'dispose']);
  });
});
