import {StrictMode} from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@core/schema/appFlush';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/app/shell/columnWidthStore';
import {seedSampleService} from '@fixtures/renderer/session/sampleService';
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

function mountPrep() {
  const fixture = editorFixture();
  const list = () =>
    [...fixture.documents.values()].map(({song, access}) => ({
      id: song.id,
      title: song.title,
      slideCount: song.slides.length,
      usedBy: [],
      access,
    }));
  vi.spyOn(fixture.api.songs, 'list').mockImplementation(async () => list());
  const send = vi.spyOn(fixture.api.live, 'send');
  const flushListeners = new Set<(request: AppFlushRequest) => void>();
  vi.spyOn(fixture.api.app, 'subscribeFlushRequests').mockImplementation(
    listener => {
      flushListeners.add(listener);
      return () => {
        flushListeners.delete(listener);
      };
    },
  );
  const requestFlush = (request: AppFlushRequest) => {
    for (const listener of flushListeners) listener(request);
  };
  window.llp = fixture.api;
  const session = new ControlSession(fixture.api);
  sessions.push(session);
  render(
    <StrictMode>
      <App
        columnWidthStore={createMemoryColumnWidthStore()}
        session={session}
      />
    </StrictMode>,
  );
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  return {...fixture, session, send, list, flushListeners, requestFlush};
}

beforeEach(() => {
  seedSampleService();
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(async () => {
  cleanup();
  await Promise.all(sessions.splice(0).map(session => session.dispose()));
  applyService(null);
  useLive.setState({state: null});
  delete window.llp;
  vi.restoreAllMocks();
});

it('opens the library song inline and releases every listener', async () => {
  const fixture = mountPrep();
  const openWindow = vi
    .spyOn(fixture.api.window, 'openSongEditor')
    .mockResolvedValue({ok: true, value: undefined});
  fireEvent.click(screen.getByRole('tab', {name: '곡'}));
  const library = screen.getByRole('region', {name: '라이브러리'});
  fireEvent.doubleClick(
    await within(library).findByRole('option', {
      name: fixture.first.song.title,
    }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', {name: '슬라이드 1 가사'}),
    ).toBeDefined(),
  );
  expect(openWindow).not.toHaveBeenCalled();
  expect(screen.queryByRole('listbox', {name: '예배 순서'})).toBeNull();
  fireEvent.click(screen.getByRole('tab', {name: '진행'}));
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  cleanup();
  await fixture.session.dispose();
  expect(fixture.listenerCount()).toBe(0);
});
