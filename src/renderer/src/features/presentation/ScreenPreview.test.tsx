import {act, cleanup, render} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {classes} from '@renderer/rendering/classes';
import {useLive} from '@renderer/platform/live';
import {ScreenPreview} from './ScreenPreview';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('llp', undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockReturnValue(undefined);
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockReturnValue(undefined);
  const initial = emptyLiveState();
  useLive.setState({
    state: {
      ...initial,
      version: 1,
      layers: {
        ...initial.layers,
        slide: {
          itemId: 'fixture',
          position: 0,
          label: null,
          lines: ['Current frame'],
        },
      },
    },
  });
});
afterEach(() => {
  cleanup();
  useLive.setState({state: null});
});

it('remounts the current frame instantly with the same transition mechanism as output reveal', () => {
  const first = render(<ScreenPreview screenId="main" chroma={false} />);
  expect(
    first.container
      .querySelector(`.${classes.root}`)
      ?.classList.contains(classes.instant),
  ).toBe(true);
  first.unmount();
  const second = render(<ScreenPreview screenId="main" chroma={false} />);
  const root = second.container.querySelector(`.${classes.root}`);
  expect(root?.classList.contains(classes.instant)).toBe(true);
  expect(second.container.textContent).toContain('Current frame');
  act(() => {
    const current = useLive.getState().state;
    if (current === null) throw new Error('Missing state');
    useLive.setState({
      state: {
        ...current,
        version: 2,
        layers: {
          ...current.layers,
          slide: {
            itemId: 'fixture',
            position: 1,
            label: null,
            lines: ['Next frame'],
          },
        },
      },
    });
  });
  expect(root?.classList.contains(classes.instant)).toBe(false);
  expect(second.container.textContent).toContain('Next frame');
});
