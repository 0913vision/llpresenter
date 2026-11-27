import {afterEach, expect, it, vi} from 'vitest';
import type {RendererLogEntry} from '@core/schema/app/ipcPayloads';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {reportStillFailure, SlideStill} from '@renderer/rendering/slideStill';

interface ViewState {
  refits: number;
  disposed: boolean;
}

/** The state of every theme view a still made, in order. */
const views = vi.hoisted((): ViewState[] => []);

vi.mock('@renderer/rendering/theme/themeView', () => ({
  ThemeView: class {
    readonly state = {refits: 0, disposed: false};
    constructor() {
      views.push(this.state);
    }
    draw(): void {}
    refit(): void {
      this.state.refits++;
    }
    dispose(): void {
      this.state.disposed = true;
    }
  },
}));

afterEach(() => {
  delete window.llp;
});

it('writes a picture a slide still can not show once, as a warning that names it', () => {
  const write = vi.fn<(entry: RendererLogEntry) => void>();
  window.llp = mockLlpApi({log: {write}});
  const gone = {mediaId: '1d26a4f8-fa96-4f90-9623-612b097f7ef5'};
  for (let thumbnail = 0; thumbnail < 20; thumbnail++) {
    reportStillFailure('could not load a preview picture', gone);
  }
  reportStillFailure('could not load a preview picture', {mediaId: 'other'});
  expect(write.mock.calls.map(([entry]) => entry)).toEqual([
    {
      level: 'warn',
      message: 'could not load a preview picture',
      detail: JSON.stringify(gone),
    },
    {
      level: 'warn',
      message: 'could not load a preview picture',
      detail: '{"mediaId":"other"}',
    },
  ]);
});

it('lays out again every open still when the fonts load, and forgets a still once it is gone', () => {
  window.llp = mockLlpApi();
  views.length = 0;
  const kept = new SlideStill(document.createElement('div'));
  const gone = new SlideStill(document.createElement('div'));
  gone.dispose();
  document.fonts.dispatchEvent(new Event('loadingdone'));
  expect(views).toEqual([
    {refits: 1, disposed: false},
    {refits: 0, disposed: true},
  ]);
  kept.dispose();
  document.fonts.dispatchEvent(new Event('loadingdone'));
  expect(views[0]).toEqual({refits: 1, disposed: true});
});
