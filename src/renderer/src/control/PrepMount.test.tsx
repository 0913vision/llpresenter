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
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {createAppFlushRequestId} from '@shared/schema/ids';
import {editorFixture, editorSong} from '@renderer/prep/editor/editorFixture';
import {createMemoryColumnWidthStore} from '@renderer/shell/columnWidthStore';
import {seedSampleService} from '@renderer/show/testing/sampleService';
import {useLive} from '@renderer/state/live';
import {applyService} from '@renderer/state/show';
import {App} from './App';
import {ControlSession} from './controlSession';

vi.mock('@renderer/render/outputRenderer', () => ({
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
  expect(fixture.listenerCount()).toBe(6);
  const input = screen.getByRole('textbox', {name: '슬라이드 1 가사'});
  fireEvent.focus(input);
  fireEvent.change(input, {target: {value: 'Invented changed line'}});
  fireEvent.blur(input);
  await waitFor(() => expect(fixture.edits).toHaveLength(1));
  fireEvent.click(screen.getByRole('tab', {name: '진행'}));
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  expect(fixture.listenerCount()).toBe(6);
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
    fixture.first.song.slides[0]?.lines.join('\n'),
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
  expect(fixture.listenerCount()).toBe(6);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('creates 새 곡 and focuses and selects its title without sending output commands', async () => {
  const fixture = mountPrep();
  await screen.findByRole('option', {name: fixture.first.song.title});
  const sourceDocument = editorSong(3);
  const created = {
    ...sourceDocument,
    song: {
      ...sourceDocument.song,
      title: '새 곡',
      slides: [{lines: ['']}],
      arrangements: [],
    },
  };
  vi.spyOn(fixture.api.content, 'edit').mockImplementation(async edit => {
    if (edit.type !== 'song.create') throw new Error('Unexpected fixture edit');
    fixture.pushSong(created);
    return {ok: true, value: {id: created.song.id, revision: created.revision}};
  });
  fireEvent.click(screen.getByRole('button', {name: '새 곡'}));
  await waitFor(() =>
    expect(
      fixture.session.editor?.getSnapshot().session?.document.song.id,
    ).toBe(created.song.id),
  );
  expect(screen.getByRole('textbox', {name: '슬라이드 1 가사'})).toHaveProperty(
    'value',
    '',
  );
  const title = screen.getByRole('textbox', {name: '곡 제목'});
  expect(title).toHaveProperty('value', '새 곡');
  await waitFor(() => expect(document.activeElement).toBe(title));
  expect(title).toHaveProperty('selectionStart', 0);
  expect(title).toHaveProperty('selectionEnd', created.song.title.length);
  expect(fixture.send).not.toHaveBeenCalled();
});

it('shares the host warning stack and dismisses a failed library load before retrying', async () => {
  const fixture = mountPrep();
  vi.spyOn(fixture.api.songs, 'list').mockRejectedValue(
    new Error('Invented read failure'),
  );
  fireEvent.click(screen.getByRole('tab', {name: '진행'}));
  fireEvent.click(screen.getByRole('tab', {name: '준비'}));
  await screen.findByText('라이브러리 불러오기 실패');
  expect(screen.getAllByRole('alert')).toHaveLength(1);
  vi.mocked(fixture.api.songs.list).mockResolvedValue(fixture.list());
  fireEvent.click(screen.getByRole('button', {name: '다시 불러오기'}));
  await screen.findByRole('option', {name: fixture.first.song.title});
  expect(screen.queryByText('라이브러리 불러오기 실패')).toBeNull();
  await act(async () => fixture.session.dispose());
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
  expect(screen.queryByText('편집 내용 저장 실패')).toBeNull();
  await act(async () => fixture.session.dispose());
  expect(fixture.flushListeners.size).toBe(0);
});

it('keeps a refused draft and offers 그래도 닫기 in the host warning stack', async () => {
  const fixture = mountPrep();
  await openSong(fixture.first.song.title);
  const editor = fixture.session.editor;
  if (editor === undefined) throw new Error('Missing editor');
  vi.spyOn(editor, 'flush').mockResolvedValue(false);
  const flushDone = vi.spyOn(fixture.api.app, 'flushDone');
  const closeAnyway = vi.spyOn(fixture.api.app, 'closeAnyway');
  const requestId = createAppFlushRequestId(
    'd74b3f85-ab42-4d5e-9f60-718293041526',
  );
  act(() => {
    fixture.requestFlush({requestId});
  });
  await screen.findByText('편집 내용 저장 실패');
  expect(flushDone).toHaveBeenCalledExactlyOnceWith({requestId, result: false});
  expect(closeAnyway).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', {name: '그래도 닫기'}));
  expect(closeAnyway).toHaveBeenCalledOnce();
  expect(screen.queryByText('편집 내용 저장 실패')).toBeNull();
  await act(async () => fixture.session.dispose());
});
