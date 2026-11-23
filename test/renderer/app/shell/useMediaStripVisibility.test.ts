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
  const save = vi.spyOn(api.ui, 'setRememberedView');
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

it.each([900, 1080, 899, 768])(
  'starts hidden without a saved choice in a window %i high',
  height => {
    const {api, save} = setup(height);
    const {result} = renderHook(() => useMediaStripVisibility(undefined, api));
    expect(result.current.visible).toBe(false);
    expect(save).not.toHaveBeenCalled();
  },
);

it.each([
  {height: 1080, saved: false},
  {height: 768, saved: true},
] as const)(
  'restores a saved $saved choice and saves only an explicit toggle',
  ({height, saved}) => {
    const {api, save} = setup(height);
    const {result} = renderHook(() => useMediaStripVisibility(saved, api));
    expect(result.current.visible).toBe(saved);
    expect(save).not.toHaveBeenCalled();
    act(() => result.current.setVisible(!saved));
    expect(save).toHaveBeenCalledExactlyOnceWith({mediaStrip: !saved});
    resizeTo(height + 1);
    expect(result.current.visible).toBe(!saved);
    expect(save).toHaveBeenCalledTimes(1);
  },
);

it('keeps the default collapsed after a zoom change and resize without saving a choice', () => {
  const {api, getZoomFactor, save} = setup(750, 1.2);
  const {result} = renderHook(() => useMediaStripVisibility(undefined, api));
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
  const {result} = renderHook(() => useMediaStripVisibility(undefined, api));

  act(() => result.current.setVisible(false));

  expect(result.current.visible).toBe(false);
  expect(write).toHaveBeenCalledWith({
    level: 'error',
    message: 'Could not save media strip visibility',
    detail: 'Invented visibility send failure',
  });
});
