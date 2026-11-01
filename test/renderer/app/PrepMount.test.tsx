import {mediaBinToggle} from '@fixtures/renderer/features/media/mediaTesting';
import {StrictMode} from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {AppFlushRequest} from '@core/schema/appFlush';
import {createAppFlushRequestId} from '@core/schema/ids';
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
      slideCount: song.groups.reduce(
        (count, group) => count + group.slides.length,
        0,
      ),
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

async function openSong(title: string): Promise<void> {
  const library = screen.getByRole('region', {name: '라이브러리'});
  fireEvent.click(await within(library).findByRole('option', {name: title}));
  await screen.findByRole('textbox', {name: '슬라이드 1 가사'});
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

it('opens the real library editor and preserves typing and undo across workspace changes', async () => {
  const fixture = mountPrep();
  await openSong(fixture.first.song.title);
  const editor = fixture.session.editor;
  expect(fixture.listenerCount()).toBe(9);
  const input = screen.getByRole('textbox', {name: '슬라이드 1 가사'});
  fireEvent.focus(input);
  fireEvent.change(input, {target: {value: 'Invented changed line'}});
  fireEvent.blur(input);
  await waitFor(() => expect(fixture.edits).toHaveLength(1));
  fireEvent.click(screen.getByRole('tab', {name: '진행'}));
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  expect(fixture.listenerCount()).toBe(9);
  expect(fixture.session.editor).toBe(editor);
  expect(screen.getByRole('textbox', {name: '슬라이드 1 가사'})).toHaveProperty(
    'value',
    'Invented changed line',
  );
  fireEvent.keyDown(screen.getByRole('textbox', {name: '슬라이드 1 가사'}), {
    code: 'KeyZ',
    ctrlKey: true,
  });
  await waitFor(() => expect(fixture.edits).toHaveLength(2));
  expect(screen.getByRole('textbox', {name: '슬라이드 1 가사'})).toHaveProperty(
    'value',
    fixture.first.song.groups
      .flatMap(group => group.slides)[0]
      ?.lines.join('\n'),
  );
  expect(fixture.send).not.toHaveBeenCalled();
  cleanup();
  await fixture.session.dispose();
  expect(fixture.listenerCount()).toBe(0);
});

it('switches back to service context even when selecting the same service row', async () => {
  const fixture = mountPrep();
  const service = screen.getByRole('listbox', {name: '예배 순서'});
  const row = within(service).getAllByRole('option')[0];
  if (!row) throw new Error('Missing service row');
  fireEvent.click(row);
  await openSong(fixture.first.song.title);
  expect(screen.queryByRole('region', {name: '항목 설정'})).toBeNull();
  fireEvent.click(row);
  expect(screen.queryByRole('textbox', {name: '슬라이드 1 가사'})).toBeNull();
  expect(screen.getByRole('region', {name: '항목 설정'})).toBeDefined();
  expect(screen.getByRole('region', {name: '미리보기'})).toBeDefined();
  expect(fixture.listenerCount()).toBe(9);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('submits a typed but unsent lyric edit when main asks to flush before quitting', async () => {
  const fixture = mountPrep();
  await openSong(fixture.first.song.title);
  const edit = vi.spyOn(fixture.api.content, 'edit');
  const flushDone = vi.spyOn(fixture.api.app, 'flushDone');
  const input = screen.getByRole('textbox', {name: '슬라이드 1 가사'});
  fireEvent.focus(input);
  fireEvent.change(input, {target: {value: 'Invented unsent line'}});
  expect(edit).not.toHaveBeenCalled();
  const requestId = createAppFlushRequestId(
    'c63a2e74-9a31-4c4d-8e5f-607182930415',
  );
  act(() => {
    fixture.requestFlush({requestId});
  });
  await waitFor(() => expect(flushDone).toHaveBeenCalledOnce());
  expect(flushDone).toHaveBeenCalledWith({requestId, result: true});
  expect(edit).toHaveBeenCalledOnce();
  expect(JSON.stringify(fixture.edits)).toContain('Invented unsent line');
  expect(edit.mock.invocationCallOrder[0]).toBeLessThan(
    flushDone.mock.invocationCallOrder[0] ?? -Infinity,
  );
  expect(screen.queryByRole('alertdialog')).toBeNull();
  const locked = screen.getByRole('textbox', {name: '슬라이드 1 가사'});
  expect(locked).toHaveProperty('readOnly', true);
  fireEvent.change(locked, {target: {value: 'Invented late line'}});
  fireEvent.blur(locked);
  await act(async () => {
    await Promise.resolve();
  });
  expect(edit).toHaveBeenCalledOnce();
  expect(JSON.stringify(fixture.edits)).not.toContain('Invented late line');
  await act(async () => fixture.session.dispose());
  expect(fixture.flushListeners.size).toBe(0);
});

it('opens and closes the shared media bin while keeping the library mounted', async () => {
  mountPrep();
  const library = screen.getByRole('region', {name: '라이브러리'});
  const toggle = mediaBinToggle();
  expect(mediaBinToggle().getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(toggle);
  expect(
    await screen.findByRole('listbox', {name: '모든 미디어'}),
  ).toBeDefined();
  expect(mediaBinToggle().getAttribute('aria-expanded')).toBe('true');
  expect(screen.getByRole('region', {name: '미디어'})).toBeDefined();
  expect(screen.getByRole('region', {name: '오디오'})).toBeDefined();
  expect(screen.getByRole('region', {name: '미디어 속성'})).toBeDefined();
  expect(screen.getByRole('region', {name: '라이브러리'})).toBe(library);
  fireEvent.click(mediaBinToggle());
  expect(screen.queryByRole('listbox', {name: '모든 미디어'})).toBeNull();
  expect(screen.getByRole('region', {name: '라이브러리'})).toBe(library);
});
