import {mediaBinToggle} from '@fixtures/renderer/features/media/mediaTesting';
import {cleanup, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import type {UiState} from '@core/schema/uiState';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {useLive} from '@renderer/session/live';
import {applyService} from '@renderer/session/show';
import {App} from '@renderer/app/App';
import {ControlSession} from '@renderer/app/controlSession';

vi.mock('@renderer/rendering/outputRenderer', () => ({
  OutputRenderer: class {
    render = vi.fn();
    dispose = vi.fn();
  },
}));

const sessions: ControlSession[] = [];
function setup(width = 1920, height = 1080, uiState: UiState = {}) {
  vi.stubGlobal('innerWidth', width);
  vi.stubGlobal('innerHeight', height);
  const {api} = editorFixture();
  const send = vi.spyOn(api.live, 'send');
  const save = vi.spyOn(api.ui, 'setMediaStrip');
  window.llp = api;
  const session = new ControlSession(api);
  sessions.push(session);
  return {
    api,
    send,
    save,
    mount: () =>
      render(
        <App
          session={session}
          columnWidthStore={createMemoryColumnWidthStore()}
          uiState={uiState}
        />,
      ),
  };
}

beforeEach(() => {
  applyService(null);
  useLive.setState({state: emptyLiveState()});
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  delete window.llp;
  useLive.setState({state: null});
});

it('unmounts the player panels while retaining summary feeds until leaving the workspaces', async () => {
  const {api, send, mount} = setup();
  const stopMedia = vi.fn();
  const stopCopies = vi.fn();
  const subscribe = vi.spyOn(api.media, 'subscribe').mockReturnValue(stopMedia);
  vi.spyOn(api.media, 'subscribeImports').mockReturnValue(stopCopies);
  mount();
  await screen.findByRole('region', {name: '미디어'});
  await userEvent.click(mediaBinToggle());
  expect(screen.queryByRole('region', {name: '미디어'})).toBeNull();
  expect(stopMedia).not.toHaveBeenCalled();
  expect(stopCopies).not.toHaveBeenCalled();
  await userEvent.click(mediaBinToggle());
  await screen.findByRole('region', {name: '미디어'});
  expect(subscribe).toHaveBeenCalledOnce();
  await userEvent.click(screen.getByRole('tab', {name: '테마'}));
  expect(stopMedia).toHaveBeenCalledOnce();
  expect(stopCopies).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});
