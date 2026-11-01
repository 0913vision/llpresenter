import {describe, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {CAPTIONS, MAIN, overlaySettings, STAGE} from '@fixtures/core/overlays';
import {
  followRenderScreen,
  resolveRenderScreen,
} from '@renderer/rendering/screenIdentity';

function screens() {
  const document = overlaySettings().reader.get('screens');
  if (document.name !== 'screens') throw new Error('Missing screen fixtures');
  return document;
}

describe('output screen identity', () => {
  it('resolves exact configured ids and the legacy output aliases without guessing unknown ids', () => {
    const {value} = screens();
    expect(resolveRenderScreen(MAIN, value.screens)).toEqual({
      id: MAIN,
      name: 'Main',
      kind: 'audience',
      method: 'fullscreen',
      emptyColor: '#000000',
    });
    expect(resolveRenderScreen('main', value.screens)?.id).toBe(MAIN);
    expect(resolveRenderScreen('captions', value.screens)?.id).toBe(CAPTIONS);
    expect(resolveRenderScreen('broadcast', value.screens)?.id).toBe(CAPTIONS);
    expect(resolveRenderScreen('stage', value.screens)).toEqual({
      id: STAGE,
      name: 'Stage',
      kind: 'stage',
      method: 'fullscreen',
      emptyColor: '#000000',
    });
    expect(resolveRenderScreen('unknown', value.screens)).toBeUndefined();
  });

  it('carries the picture correction only when it changes the picture', () => {
    const {value} = screens();
    expect(
      resolveRenderScreen(
        MAIN,
        value.screens.map(screen => ({
          ...screen,
          edgeMargin: 5,
          offset: {x: 12, y: -6},
        })),
      ),
    ).toEqual({
      id: MAIN,
      name: 'Main',
      kind: 'audience',
      method: 'fullscreen',
      emptyColor: '#000000',
      correction: {edgeMargin: 5, offset: {x: 12, y: -6}},
    });
    const only = (edgeMargin: number, x: number, y: number) =>
      resolveRenderScreen(
        MAIN,
        value.screens.map(screen => ({...screen, edgeMargin, offset: {x, y}})),
      );
    expect(only(0, 0, 0)).not.toHaveProperty('correction');
    expect(only(0, 3, 0)?.correction?.offset).toEqual({x: 3, y: 0});
    expect(only(0, 0, -3)?.correction?.offset).toEqual({x: 0, y: -3});
  });

  it('logs a failed read and ignores a read that resolves after disposal', async () => {
    const onError = vi.fn();
    const failure = new Error('Fixture screen read failure');
    const stop = followRenderScreen({
      settings: mockLlpApi({settings: {get: () => Promise.reject(failure)}})
        .settings,
      id: 'main',
      receive: vi.fn(),
      onError,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      'could not read output screen identity',
      failure,
    );
    stop();
    const receive = vi.fn();
    const stopEarly = followRenderScreen({
      settings: mockLlpApi({settings: {get: () => Promise.resolve(screens())}})
        .settings,
      id: 'main',
      receive,
      onError,
    });
    stopEarly();
    await Promise.resolve();
    expect(receive).not.toHaveBeenCalled();
  });
});
