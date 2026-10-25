import {isValidElement, type ReactNode} from 'react';
import {act, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {editorFixture} from '@renderer/prep/editor/editorFixture';
import {ControlSession} from './controlSession';

const root = vi.hoisted(() => ({render: vi.fn(), unmount: vi.fn()}));
const stops = vi.hoisted(() => ({live: vi.fn(), service: vi.fn()}));
vi.mock('react-dom/client', () => ({createRoot: () => root}));
vi.mock('@renderer/state/live', () => ({startLiveSync: () => stops.live}));
vi.mock('@renderer/state/show', () => ({
  startServiceSync: () => stops.service,
}));

it('creates a window session outside render and releases its resources on pagehide once', async () => {
  const fixture = editorFixture();
  const uiState = {mediaStrip: false, layout: {narrow: {leftCollapsed: true}}};
  vi.spyOn(fixture.api.ui, 'get').mockResolvedValue(uiState);
  window.llp = fixture.api;
  const container = document.createElement('div');
  container.id = 'root';
  document.body.append(container);
  try {
    await act(async () => {
      await import('./main');
    });
    await waitFor(() => expect(root.render).toHaveBeenCalledTimes(1));
    const tree: unknown = root.render.mock.calls[0]?.[0];
    if (
      !isValidElement<{children: ReactNode}>(tree) ||
      !isValidElement<{session: unknown; uiState: unknown}>(tree.props.children)
    ) {
      throw new Error('Missing application element');
    }
    const session = tree.props.children.props.session;
    expect(tree.props.children.props.uiState).toEqual(uiState);
    if (!(session instanceof ControlSession)) {
      throw new Error('Missing control session');
    }
    expect(session.editor).toBeUndefined();
    session.startEditor();
    expect(fixture.listenerCount()).toBe(3);
    const dispose = vi.spyOn(session, 'dispose');
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(fixture.listenerCount()).toBe(0));
    window.dispatchEvent(new Event('pagehide'));
    expect(root.unmount).toHaveBeenCalledTimes(1);
    expect(stops.live).toHaveBeenCalledTimes(1);
    expect(stops.service).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
  } finally {
    container.remove();
    delete window.llp;
  }
});
