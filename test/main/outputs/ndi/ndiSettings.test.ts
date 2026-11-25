import {describe, expect, it} from 'vitest';
import {NDI_DEFAULT_FPS} from '@core/schema/screens/screens';
import {ndiSettingsChange} from '@main/outputs/ndi/ndiSettings';
import type {OutputScreen} from '@main/outputs/screens';
import {fullScreenScreen} from '@fixtures/main/outputs/testing';

function broadcast(ndi: NonNullable<OutputScreen['ndi']>) {
  return fullScreenScreen({
    id: 'broadcast',
    method: 'capture',
    target: 'ndi',
    ndi,
  });
}

describe('ndiSettingsChange', () => {
  it('leaves the sender alone when neither its name nor its frame rate changed', () => {
    expect(
      ndiSettingsChange(
        broadcast({sourceName: '방송', fps: 30}),
        broadcast({sourceName: '방송', fps: 30}),
      ),
    ).toEqual({restart: false, frameRate: undefined});
  });

  it('restarts the sender under a new name without touching the drawing rate', () => {
    expect(
      ndiSettingsChange(
        broadcast({sourceName: '방송'}),
        broadcast({sourceName: '예배 방송'}),
      ),
    ).toEqual({restart: true, frameRate: undefined});
  });

  it('restarts the sender at a new frame rate and draws at 60 above 30, else at 30', () => {
    expect(
      ndiSettingsChange(broadcast({fps: 30}), broadcast({fps: 60})),
    ).toEqual({restart: true, frameRate: 60});
    expect(
      ndiSettingsChange(broadcast({fps: 60}), broadcast({fps: 29.97})),
    ).toEqual({restart: true, frameRate: 30});
    expect(
      ndiSettingsChange(broadcast({fps: 30}), broadcast({fps: 59.94})),
    ).toEqual({restart: true, frameRate: 60});
  });

  it('counts a missing frame rate as the default one', () => {
    expect(
      ndiSettingsChange(broadcast({}), broadcast({fps: NDI_DEFAULT_FPS})),
    ).toEqual({restart: false, frameRate: undefined});
  });
});
