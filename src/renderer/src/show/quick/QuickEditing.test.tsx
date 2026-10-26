import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {parseServiceDocument} from '@shared/schema/contentDocuments';
import {createQuickItemId} from '@shared/schema/ids';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {openLibrarySong} from '@renderer/state/showLibrary';
import {QuickPanel} from './QuickPanel';
import {openBiblePassage} from '../bible/actions';
import {panelPassage} from '../bible/panelTesting';
import {MAX_QUICK_ITEMS, newQuickItem, saveQuickEdit} from './quickEdits';
import {
  deferred,
  quickDocument,
  quickFixture,
  quickId,
  quickItem,
  quickLive,
} from './quickTesting';

function setup() {
  const base = quickFixture();
  let document = quickDocument();
  const push = (next: typeof document): void => {
    document = next;
    base.pushQuick(next);
  };
  const get = vi.fn<LlpApi['settings']['get']>(request =>
    request.name === 'quick' ? Promise.resolve(document) : base.get(request),
  );
  const edit = vi.fn<LlpApi['settings']['edit']>(change => {
    if (change.type !== 'settings.update' || change.name !== 'quick') {
      throw new Error('Unexpected edit');
    }
    push({...document, revision: document.revision + 1, value: change.value});
    return Promise.resolve({
      ok: true,
      value: {id: 'quick', revision: document.revision},
    });
  });
  const api = fakeLlpApi({
    ...base.api,
    settings: {...base.api.settings, get, edit},
  });
  const problem = vi.fn();
  window.llp = api;
  return {
    ...base,
    api,
    get,
    edit,
    problem,
    push,
    current: () => document,
    mount: () =>
      render(<QuickPanel selectionVersion={0} onProblem={problem} />),
  };
}

beforeEach(() => {
  vi.spyOn(crypto, 'randomUUID').mockReturnValue(
    '00000000-0000-4000-8000-000000000999',
  );
  HTMLElement.prototype.scrollIntoView = vi.fn();
  useShow.setState({
    openItemId: null,
    bibleSource: null,
    liveBibleSource: null,
    requestedBibleSource: null,
    librarySong: null,
    serviceId: null,
  });
  useLive.setState({state: quickLive()});
});
afterEach(() => {
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

describe('quick editing', () => {
  it.each(['song', 'bible'] as const)(
    'copies the current service %s reference',
    async kind => {
      const fixture = setup();
      const bible = quickItem('bible');
      if (bible.kind !== 'bible') throw new Error('Missing Bible fixture');
      const parsed = parseServiceDocument({
        revision: 1,
        access: 'editable',
        service: {
          format: 'llservice',
          schemaVersion: 1,
          id: quickId(900),
          name: '테스트 예배',
          date: '2026-10-26T09:00',
          order: [
            kind === 'song'
              ? {id: quickId(901), song: fixture.song.songId}
              : {id: quickId(901), bible: bible.ref},
          ],
        },
      });
      if (!parsed.ok || parsed.value === null) {
        throw new Error('Invalid service fixture');
      }
      vi.spyOn(fixture.api.services, 'get').mockResolvedValue(parsed.value);
      useShow.setState({
        serviceId: quickId(900),
        openItemId: quickId(901),
        rows: [{id: quickId(901), kind, title: '예배 항목'}],
      });
      fixture.mount();
      fireEvent.click(
        await screen.findByRole('button', {name: '퀵 실행 추가'}),
      );
      const current = await screen.findByRole('menuitem', {
        name: /현재 항목 추가/,
      });
      await waitFor(() =>
        expect(current.getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(current);
      await waitFor(() =>
        expect(fixture.current().value.items.at(-1)).toMatchObject({
          kind,
          ref: kind === 'song' ? fixture.song.songId : bible.ref,
        }),
      );
      expect(fixture.send).not.toHaveBeenCalled();
    },
  );
  it('copies the open Bible preview without writing output or recent history', async () => {
    const fixture = setup();
    openBiblePassage(panelPassage());
    fixture.mount();
    fireEvent.click(await screen.findByRole('button', {name: '퀵 실행 추가'}));
    const current = await screen.findByRole('menuitem', {
      name: /현재 항목 추가/,
    });
    await waitFor(() =>
      expect(current.getAttribute('aria-disabled')).not.toBe('true'),
    );
    fireEvent.click(current);
    await waitFor(() =>
      expect(fixture.current().value.items.at(-1)).toMatchObject({
        kind: 'bible',
        ref: {ref: panelPassage().ref, split: 'verse', reference: 'none'},
      }),
    );
    expect(fixture.send).not.toHaveBeenCalled();
    expect(fixture.document().value.recents).toEqual([]);
  });
  it('adds the open library song and keeps its background out of the saved target', async () => {
    const fixture = setup();
    openLibrarySong(fixture.song);
    fixture.mount();
    fireEvent.click(await screen.findByRole('button', {name: '퀵 실행 추가'}));
    const current = await screen.findByRole('menuitem', {
      name: /현재 항목 추가/,
    });
    await waitFor(() =>
      expect(current.getAttribute('aria-disabled')).not.toBe('true'),
    );
    fireEvent.click(current);
    await waitFor(() =>
      expect(fixture.current().value.items.at(-1)).toEqual({
        id: '00000000-0000-4000-8000-000000000999',
        kind: 'song',
        ref: fixture.song.songId,
        name: fixture.song.title,
      }),
    );
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('renames and deletes an unknown row without changing live output or its extra fields', async () => {
    const fixture = setup();
    fixture.mount();
    const live = useLive.getState().state;
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '새 버전 항목'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const name = screen.getByRole('textbox', {name: '이름'});
    fireEvent.change(name, {target: {value: '  '}});
    expect(
      screen.getByRole('button', {name: '저장'}).getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.change(name, {target: {value: '  새 이름  '}});
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    const row = await screen.findByRole('button', {name: '새 이름'});
    expect(fixture.current().value.items.at(-1)).toMatchObject({
      name: '새 이름',
      extension: true,
    });
    fireEvent.contextMenu(row);
    fireEvent.click(await screen.findByRole('menuitem', {name: '삭제'}));
    await waitFor(() =>
      expect(screen.queryByRole('button', {name: '새 이름'})).toBeNull(),
    );
    expect(useLive.getState().state).toBe(live);
    expect(fixture.send).not.toHaveBeenCalled();
  });
  it('retries once on a fresh revision and preserves concurrent changes', async () => {
    const fixture = setup();
    fixture.edit.mockImplementationOnce(() => {
      const fresh = quickDocument(2);
      fixture.push({
        ...fresh,
        value: {
          ...fresh.value,
          items: [
            ...fresh.value.items,
            {
              ...quickItem('black'),
              id: createQuickItemId(quickId(88)),
              name: '다른 변경',
            },
          ],
        },
      });
      return Promise.resolve({
        ok: false,
        error: {reason: 'stale', message: 'Invented stale edit'},
      });
    });
    await saveQuickEdit(fixture.api, {
      kind: 'rename',
      id: quickItem('song').id,
      name: '새 곡 이름',
    });
    expect(fixture.edit).toHaveBeenCalledTimes(2);
    expect(fixture.current().value.items.at(-1)?.name).toBe('다른 변경');
    expect(fixture.edit.mock.calls[1]?.[0]).toMatchObject({baseRevision: 2});
  });
  it('refuses read-only edits and additions at the list cap', async () => {
    const fixture = setup();
    fixture.get.mockResolvedValueOnce({...quickDocument(), access: 'readOnly'});
    await expect(
      saveQuickEdit(fixture.api, {kind: 'delete', id: quickItem('song').id}),
    ).rejects.toThrow();
    const full = quickDocument();
    fixture.push({
      ...full,
      value: {
        ...full.value,
        items: Array.from({length: MAX_QUICK_ITEMS}, (_, index) => ({
          ...quickItem('black'),
          id: createQuickItemId(quickId(index + 1)),
        })),
      },
    });
    await expect(
      saveQuickEdit(fixture.api, {
        kind: 'add',
        item: newQuickItem({kind: 'black', name: '검은 화면'}),
      }),
    ).rejects.toThrow();
    expect(fixture.edit).not.toHaveBeenCalled();
  });
  it('locks duplicate saves and leaves a failed rename open for correction', async () => {
    const fixture = setup();
    fixture.mount();
    const result = deferred<EditResult>();
    fixture.edit.mockReturnValueOnce(result.promise);
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '저장된 곡'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const save = screen.getByRole('button', {name: '저장'});
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    await waitFor(() => expect(fixture.edit).toHaveBeenCalledOnce());
    await act(async () =>
      result.resolve({
        ok: false,
        error: {reason: 'saves-full', message: 'Invented save refusal'},
      }),
    );
    expect(fixture.problem).toHaveBeenCalledOnce();
    expect(
      screen.getByRole('dialog', {name: '퀵 실행 이름 바꾸기'}),
    ).toBeTruthy();
  });
});
