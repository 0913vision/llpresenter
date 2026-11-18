import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {useMediaStripVisibility} from '@renderer/app/shell/useMediaStripVisibility';

function setup(height: number, zoomFactor = 1) {
  vi.stubGlobal('innerHeight', height);
  const api = mockLlpApi();
  const getZoomFactor = vi
    .spyOn(api.ui, 'getZoomFactor')
    .mockReturnValue(zoomFactor);
  const save = vi.spyOn(api.ui, 'setMediaStrip');
  return {api, getZoomFactor, save};
}

function resizeTo(height: number): void {
  vi.stubGlobal('innerHeight', height);
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

it.each([
  {sizeClass: 'normal', height: 900, visible: false},
  {sizeClass: 'wide', height: 1080, visible: false},
  {sizeClass: 'normal', height: 899, visible: false},
  {sizeClass: 'narrow', height: 1080, visible: false},
] as const)(
  'starts $visible in a $sizeClass window $height high',
  ({sizeClass, height, visible}) => {
    const {api, save} = setup(height);
    const {result} = renderHook(() =>
      useMediaStripVisibility(sizeClass, undefined, api),
    );
    expect(result.current.visible).toBe(visible);
    expect(save).not.toHaveBeenCalled();
  },
);

it.each([
  {sizeClass: 'wide', height: 1080, saved: false},
  {sizeClass: 'narrow', height: 768, saved: true},
] as const)(
  'restores a saved $saved choice at $sizeClass and saves only an explicit toggle',
  ({sizeClass, height, saved}) => {
    const {api, save} = setup(height);
    const {result} = renderHook(() =>
      useMediaStripVisibility(sizeClass, saved, api),
    );
    expect(result.current.visible).toBe(saved);
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.setVisible(!saved));
    expect(save).toHaveBeenCalledExactlyOnceWith({visible: !saved});
    resizeTo(height + 1);
    expect(result.current.visible).toBe(!saved);
    expect(save).toHaveBeenCalledTimes(1);
  },
);

it('keeps the default collapsed after a zoom change and resize without saving a choice', () => {
  const {api, getZoomFactor, save} = setup(750, 1.2);
  const {result} = renderHook(() =>
    useMediaStripVisibility('normal', undefined, api),
  );
  expect(result.current.visible).toBe(false);
  getZoomFactor.mockReturnValue(1.5);
  resizeTo(600);
  expect(result.current.visible).toBe(false);
  resizeTo(599);
  expect(result.current.visible).toBe(false);
  expect(save).not.toHaveBeenCalled();
});

it('keeps the local choice and logs a save that fails', () => {
  const {api, save} = setup(1080);
  const write = vi.spyOn(api.log, 'write');
  save.mockImplementation(() => {
    throw new Error('Invented visibility send failure');
  });
  const {result} = renderHook(() =>
    useMediaStripVisibility('normal', undefined, api),
  );

  act(() => result.current.setVisible(false));

  expect(result.current.visible).toBe(false);
  expect(write).toHaveBeenCalledWith({
    level: 'error',
    message: 'Could not save media strip visibility',
    detail: 'Invented visibility send failure',
  });
});
