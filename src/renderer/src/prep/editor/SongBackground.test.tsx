import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createMediaId} from '@core/schema/ids';
import {parseMediaDocument, type MediaDocument} from '@core/schema/mediaEdit';
import type {EditResult} from '@core/schema/contentEdit';
import {mediaUrl} from '@contracts/ipc/media';
import {editorFixture} from './editorFixture';
import {editorSetup, mockMenuRowHeight} from './editorTesting';
import {SongEditor} from './SongEditor';

function catalog(revision = 1, firstName = '푸른 바다'): MediaDocument {
  const result = parseMediaDocument({
    name: 'media',
    revision,
    access: 'editable',
    value: {
      format: 'llmedia',
      schemaVersion: 1,
      playlists: [],
      audioPlaylists: [],
      items: ['image', 'video', 'audio'].map((kind, index) => ({
        id: createMediaId(
          `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
        ),
        name: index === 0 ? firstName : index === 1 ? '따뜻한 빛' : '음원',
        kind,
        file: `sample-${index}`,
        size: 0,
      })),
    },
  });
  if (!result.ok) throw new Error('Invalid media fixture');
  return result.value;
}

function backgroundFixture(document = catalog()) {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  mockMenuRowHeight();
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
  const fixture = editorFixture();
  const listeners = new Set<(document: MediaDocument) => void>();
  const get = vi.spyOn(fixture.api.media, 'get').mockResolvedValue(document);
  vi.spyOn(fixture.api.media, 'subscribe').mockImplementation(listener => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  });
  return {
    ...fixture,
    document,
    get,
    log,
    listeners,
    push: (value: MediaDocument): void => {
      act(() => {
        for (const listener of listeners) listener(value);
      });
    },
  };
}

function trigger(): HTMLElement {
  return screen.getByRole('button', {name: '기본 배경'});
}

async function openPicker(): Promise<HTMLElement> {
  await waitFor(() =>
    expect(trigger().getAttribute('aria-disabled')).toBeNull(),
  );
  fireEvent.click(trigger());
  return screen.findByRole('combobox', {name: '검색'});
}

describe('song header background connection', () => {
  it('saves image, video and none from a read-only catalog and restores trigger focus', async () => {
    const fixture = backgroundFixture({...catalog(), access: 'readOnly'});
    const {session, documents, first} = await editorSetup(fixture);
    await openPicker();
    expect(screen.queryByRole('option', {name: '음원'})).toBeNull();
    fireEvent.click(screen.getByRole('option', {name: '푸른 바다'}));
    await act(() => session.flush());
    const imageId = fixture.document.value.items[0]?.id;
    expect(documents.get(first.song.id)?.song.background).toBe(imageId);
    expect(trigger().querySelector('img')?.getAttribute('src')).toBe(
      imageId === undefined ? undefined : mediaUrl(imageId),
    );
    expect(document.activeElement).toBe(trigger());
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    const search = await openPicker();
    fireEvent.change(search, {target: {value: '따뜻'}});
    fireEvent.keyDown(search, {key: 'Enter'});
    await act(() => session.flush());
    const video = trigger().querySelector('video');
    expect(video?.muted).toBe(true);
    expect(video?.autoplay).toBe(false);
    expect(documents.get(first.song.id)?.song.background).toBe(
      fixture.document.value.items[1]?.id,
    );
    await openPicker();
    fireEvent.click(screen.getByRole('option', {name: '없음'}));
    await act(() => session.flush());
    expect(
      Object.hasOwn(documents.get(first.song.id)?.song ?? {}, 'background'),
    ).toBe(false);
    expect(video?.hasAttribute('src')).toBe(false);
    expect(trigger().textContent).toBe('없음');
  });

  it.each(['older reply', 'read failure'])(
    'keeps the newer media push despite a delayed %s',
    async outcome => {
      const fixture = backgroundFixture();
      let finish: (value: MediaDocument) => void = () => undefined;
      let fail: (reason: Error) => void = () => undefined;
      fixture.get.mockImplementationOnce(
        () =>
          new Promise((resolve, reject) => {
            finish = resolve;
            fail = reject;
          }),
      );
      await editorSetup(fixture);
      expect(trigger().getAttribute('aria-disabled')).toBe('true');
      expect(trigger().getAttribute('aria-busy')).toBe('true');
      fixture.push(catalog(2, '새 배경'));
      await openPicker();
      expect(screen.getByRole('option', {name: '새 배경'})).toBeDefined();
      await act(async () => {
        if (outcome === 'older reply') finish(fixture.document);
        else fail(new Error('Delayed media read failure'));
      });
      expect(screen.queryByRole('option', {name: '푸른 바다'})).toBeNull();
      expect(screen.getByRole('option', {name: '새 배경'})).toBeDefined();
    },
  );

  it('retries a failed read and lets Escape return to the header without saving', async () => {
    const fixture = backgroundFixture();
    const cause = new Error('Media read failed');
    fixture.get.mockRejectedValueOnce(cause);
    const {edits} = await editorSetup(fixture);
    await waitFor(() => expect(trigger().getAttribute('aria-busy')).toBeNull());
    expect(fixture.log).toHaveBeenCalledWith(
      'Song background media read failed',
      cause,
    );
    fireEvent.click(trigger());
    await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
    const search = await openPicker();
    fireEvent.keyDown(search, {key: 'Escape'});
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(document.activeElement).toBe(trigger());
    expect(edits).toHaveLength(0);
  });

  it('closes an open picker on read-only access and keeps it closed when access returns', async () => {
    const fixture = backgroundFixture();
    const {first, edits} = await editorSetup(fixture);
    await openPicker();
    act(() => fixture.pushSong({...first, revision: 2, access: 'readOnly'}));
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(trigger().getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(trigger());
    expect(screen.queryByRole('combobox')).toBeNull();
    act(() => fixture.pushSong({...first, revision: 3, access: 'editable'}));
    expect(trigger().getAttribute('aria-disabled')).toBeNull();
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(edits).toHaveLength(0);
  });

  it('closes an open picker while a global label operation is busy', async () => {
    const fixture = backgroundFixture();
    const {store} = await editorSetup(fixture);
    await openPicker();
    let finish: (value: EditResult) => void = () => undefined;
    vi.spyOn(fixture.api.settings, 'edit').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    let pending = Promise.resolve(false);
    act(() => {
      pending = store.updateLabels(fixture.labels().value.labels);
    });
    try {
      expect(trigger().getAttribute('aria-disabled')).toBe('true');
      expect(screen.queryByRole('combobox')).toBeNull();
    } finally {
      finish({
        ok: false,
        error: {reason: 'read-only', message: 'Fixture refusal'},
      });
      await act(() => pending);
    }
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('updates names and allows recovery from a missing background without changing it implicitly', async () => {
    const fixture = backgroundFixture();
    const {session} = await editorSetup(fixture);
    act(() => session.setBackground(fixture.document.value.items[0]?.id));
    await act(() => session.flush());
    fixture.push(catalog(2, '바뀐 이름'));
    expect(trigger().textContent).toBe('바뀐 이름');
    const search = await openPicker();
    fireEvent.change(search, {target: {value: '바뀐'}});
    fixture.push({
      ...catalog(3),
      value: {...fixture.document.value, items: []},
    });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('combobox').getAttribute('value')).toBe('바뀐');
    expect(trigger().textContent).toBe('미디어 없음');
    expect(session.background).toBe(fixture.document.value.items[0]?.id);
    fireEvent.click(screen.getByRole('option', {name: '없음'}));
    await act(() => session.flush());
    expect(session.background).toBeUndefined();
  });

  it('retains the raw query and filtered Enter target across a catalog push', async () => {
    const fixture = backgroundFixture();
    const {session} = await editorSetup(fixture);
    const search = await openPicker();
    const query = `  ${'바다'.normalize('NFD')}  `;
    fireEvent.change(search, {target: {value: query}});
    fixture.push(catalog(2, '저녁 바다'));
    const refreshed = screen.getByRole('combobox', {name: '검색'});
    expect(refreshed.getAttribute('value')).toBe(query);
    expect(document.activeElement).toBe(refreshed);
    expect(screen.getAllByRole('option').map(item => item.textContent)).toEqual(
      ['없음', '저녁 바다'],
    );
    fireEvent.keyDown(refreshed, {key: 'Enter'});
    await act(() => session.flush());
    expect(session.background).toBe(fixture.document.value.items[0]?.id);
    const reopened = await openPicker();
    expect(reopened.getAttribute('value')).toBe('');
  });

  it('unsubscribes on unmount and ignores its late read after a remount', async () => {
    const fixture = backgroundFixture();
    let finish: (value: MediaDocument) => void = () => undefined;
    fixture.get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const {session, view, store} = await editorSetup(fixture);
    act(() => session.setBackground(fixture.document.value.items[0]?.id));
    await act(() => session.flush());
    view.rerender(<div />);
    expect(fixture.listeners.size).toBe(0);
    fixture.get.mockResolvedValue(catalog(2, '다시 연 목록'));
    view.rerender(<SongEditor store={store} />);
    await waitFor(() => expect(trigger().textContent).toBe('다시 연 목록'));
    await act(async () => finish(catalog(3, '닫힌 화면의 응답')));
    expect(trigger().textContent).toBe('다시 연 목록');
    expect(fixture.listeners.size).toBe(1);
    view.unmount();
    expect(fixture.listeners.size).toBe(0);
  });
});
