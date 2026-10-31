import {act, cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {fakeLlpApi} from '@contracts/ipc/testing/fakeLlpApi';
import {useLive} from '@renderer/session/live';
import {looksDocument, screensDocument} from '@core/testing/screenDocuments';
import {LookPreview} from './LookPreview';

const drawing = vi.hoisted(() => ({
  render: vi.fn(),
  dispose: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    constructor(...args: readonly unknown[]) {
      drawing.create(...args);
    }
    render = drawing.render;
    dispose = drawing.dispose;
  },
}));

afterEach(() => {
  cleanup();
  delete window.llp;
  useLive.setState({state: null});
  vi.clearAllMocks();
});

it('redraws from selected Look props and live layers, reusing and disposing the renderer', () => {
  const looks = looksDocument();
  const screens = screensDocument();
  if (looks.name !== 'looks' || screens.name !== 'screens') {
    throw new Error('Wrong documents');
  }
  const screen = screens.value.screens[0];
  const selected = looks.value.looks[1];
  if (screen === undefined || selected === undefined) {
    throw new Error('Missing fixture');
  }
  const send = vi.fn();
  window.llp = fakeLlpApi({live: {send}});
  useLive.setState({state: emptyLiveState()});
  const props = {screen, looks: looks.value, stageLayouts: [], timers: []};
  const view = render(<LookPreview {...props} lookId={looks.value.current} />);
  expect(drawing.create).toHaveBeenCalledOnce();
  expect(drawing.create.mock.calls[0]?.[1]).toMatchObject({mode: 'preview'});
  view.rerender(<LookPreview {...props} lookId={selected.id} />);
  const before = drawing.render.mock.calls.length;
  const state = {...emptyLiveState(), stageMessage: '다음 순서'};
  act(() => useLive.setState({state}));
  expect(drawing.render).toHaveBeenCalledTimes(before + 1);
  expect(drawing.render).toHaveBeenLastCalledWith(
    state.layers,
    expect.objectContaining({stageMessage: '다음 순서'}),
  );
  expect(drawing.create).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
  view.unmount();
  expect(drawing.dispose).toHaveBeenCalledOnce();
  const ended = drawing.render.mock.calls.length;
  act(() => useLive.setState({state: emptyLiveState()}));
  expect(drawing.render).toHaveBeenCalledTimes(ended);
});
