import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@shared/ipc';
import type {EditResult} from '@shared/schema/contentEdit';
import {parseServiceDocument} from '@shared/schema/contentDocuments';
import {createQuickItemId, createAppFlushRequestId} from '@shared/schema/ids';
import type {AppFlushRequest} from '@shared/schema/appFlush';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {parseSettingsDocument} from '@shared/schema/settingsDocuments';
import {useShow} from '@renderer/state/show';
import {useLive} from '@renderer/state/live';
import {openLibrarySong} from '@renderer/state/showLibrary';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {ControlSession} from '@renderer/control/controlSession';
import {QuickPanel} from './QuickPanel';
import {openBiblePassage} from '../bible/actions';
import {panelPassage} from '../bible/panelTesting';
import {MAX_QUICK_ITEMS, newQuickItem, saveQuickEdit} from './quickEdits';
import {useQuickEditing} from './useQuickEditing';
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
  const get = vi.fn<LlpApi['settings']['get']>(request => {
    if (request.name === 'quick') return Promise.resolve(document);
    if (
      request.name === 'props' ||
      request.name === 'timers' ||
      request.name === 'macros'
    ) {
      const contents = {
        props: {
          props: [
            {
              id: quickId(103),
              name: '소품 대상',
              content: {kind: 'image', media: quickId(111)},
              targets: [],
            },
          ],
        },
        timers: {
          timers: [{id: quickId(104), name: '타이머 대상', kind: 'clock'}],
        },
        macros: {
          macros: [
            {
              id: quickId(105),
              name: '매크로 대상',
              icon: 'macro',
              color: 'teal',
              actions: [],
            },
          ],
          collections: [],
        },
      };
      const parsed = parseSettingsDocument({
        name: request.name,
        revision: 1,
        access: 'editable',
        value: {
          format: `llsettings.${request.name}`,
          schemaVersion: 1,
          ...contents[request.name],
        },
      });
      if (!parsed.ok) throw new Error('Invalid target fixture');
      return Promise.resolve(parsed.value);
    }
    return base.get(request);
  });
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

function failPersistedEdit(edit: ReturnType<typeof setup>['edit']): void {
  const original = edit.getMockImplementation();
  if (!original) throw new Error('Missing edit fixture');
  edit.mockImplementationOnce(async change => {
    const applied = await original(change);
    if (!applied.ok) throw new Error('Fixture did not apply');
    return {
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Invented disk failure',
        applied: applied.value,
        unchangedFiles: ['quick.json'],
      },
    };
  });
}

async function openAddMenu(): Promise<void> {
  const add = screen.getByRole('button', {name: '퀵 실행 추가'});
  await waitFor(() =>
    expect(add.getAttribute('aria-disabled')).not.toBe('true'),
  );
  fireEvent.click(add);
  await screen.findByRole('menu', {name: '퀵 실행 추가'});
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
  Reflect.deleteProperty(document, 'elementFromPoint');
  cleanup();
  delete window.llp;
  vi.restoreAllMocks();
});

describe('quick editing', () => {
  it('waits for quick settings before trying to open the add menu', async () => {
    const fixture = setup();
    const reading = deferred<ReturnType<typeof quickDocument>>();
    const original = fixture.get.getMockImplementation();
    if (!original) throw new Error('Missing settings fixture');
    fixture.get.mockImplementation(request =>
      request.name === 'quick' ? reading.promise : original(request),
    );
    fixture.mount();
    const opening = openAddMenu();
    await act(async () => undefined);
    expect(
      screen
        .getByRole('button', {name: '퀵 실행 추가'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.queryByRole('menu', {name: '퀵 실행 추가'})).toBeNull();
    await act(async () => reading.resolve(quickDocument()));
    await opening;
    expect(screen.getByRole('menuitem', {name: '현재 항목 추가'})).toBeTruthy();
  });
  it.each([
    {group: '소품', name: '소품 대상', kind: 'prop'},
    {group: '타이머', name: '타이머 대상', kind: 'timer'},
    {group: '매크로', name: '매크로 대상', kind: 'macro'},
  ])(
    'adds a $kind from its submenu without output',
    async ({group, name, kind}) => {
      const fixture = setup();
      fixture.mount();
      await openAddMenu();
      const submenu = await screen.findByRole('menuitem', {name: group});
      await waitFor(() =>
        expect(submenu.getAttribute('aria-disabled')).not.toBe('true'),
      );
      fireEvent.click(submenu);
      fireEvent.click(await screen.findByRole('menuitem', {name}));
      await waitFor(() =>
        expect(fixture.current().value.items.at(-1)).toMatchObject({
          kind,
          name,
        }),
      );
      expect(fixture.send).not.toHaveBeenCalled();
      expect(fixture.problem).not.toHaveBeenCalled();
    },
  );
  it('persists a pointer reorder without running the item or clearing output', async () => {
    const fixture = setup();
    fixture.mount();
    const first = await screen.findByRole('button', {name: '저장된 곡'});
    const list = screen.getByRole('group', {name: '퀵 실행 항목'});
    const height = fixture.current().value.items.length * 30;
    vi.spyOn(list, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(0, 0, 200, height),
    );
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => list,
    });
    const live = useLive.getState().state;
    document
      .querySelectorAll<HTMLElement>('[data-quick-id]')
      .forEach((row, index) =>
        vi
          .spyOn(row, 'getBoundingClientRect')
          .mockReturnValue(new DOMRect(0, index * 30, 200, 30)),
      );
    const pointer = {pointerId: 1, button: 0, clientX: 10};
    fireEvent.pointerDown(first, {...pointer, clientY: 15});
    fireEvent.pointerMove(window, {...pointer, clientY: height - 1});
    fireEvent.pointerUp(window, {...pointer, clientY: height - 1});
    fireEvent.click(first, {detail: 1});
    await waitFor(() =>
      expect(fixture.current().value.items.at(-1)?.id).toBe(
        quickItem('song').id,
      ),
    );
    expect(fixture.edit).toHaveBeenCalledOnce();
    expect(fixture.send).not.toHaveBeenCalled();
    expect(useLive.getState().state).toBe(live);
  });
  it('moves an unknown item on the latest list and retains unrelated additions', async () => {
    const fixture = setup();
    const current = fixture.current();
    const source = current.value.items.at(-1);
    if (!source) throw new Error('Missing future row');
    const extra = {
      ...quickItem('black'),
      id: createQuickItemId(quickId(88)),
      name: '다른 변경',
    };
    fixture.push({
      ...current,
      revision: 2,
      value: {...current.value, items: [extra, ...current.value.items]},
    });
    const result = await saveQuickEdit(fixture.api, {
      kind: 'move',
      id: source.id,
      before: quickItem('song').id,
    });
    expect(result.ok).toBe(true);
    expect(fixture.current().value.items.slice(0, 3)).toMatchObject([
      extra,
      {id: source.id, extension: true},
      {id: quickItem('song').id},
    ]);
    expect(fixture.edit.mock.calls[0]?.[0]).toMatchObject({baseRevision: 2});
  });
  it.each(['self', 'same gap', 'missing source', 'missing target'])(
    'does not write a move with %s',
    async kind => {
      const fixture = setup();
      const missing = createQuickItemId(quickId(88));
      const source = kind === 'missing source' ? missing : quickItem('song').id;
      const before =
        kind === 'self'
          ? source
          : kind === 'missing target'
            ? missing
            : quickItem('bible').id;
      expect(
        (await saveQuickEdit(fixture.api, {kind: 'move', id: source, before}))
          .ok,
      ).toBe(true);
      expect(fixture.edit).not.toHaveBeenCalled();
    },
  );
  it.each([false, true])(
    'holds close through a deferred read and stale retry %s',
    async retry => {
      const fixture = setup();
      let request: (value: AppFlushRequest) => void = () => undefined;
      vi.spyOn(fixture.api.app, 'subscribeFlushRequests').mockImplementation(
        listener => {
          request = listener;
          return () => undefined;
        },
      );
      const flushed = vi.spyOn(fixture.api.app, 'flushDone');
      const session = new ControlSession(fixture.api);
      const first = deferred<ReturnType<typeof quickDocument>>();
      const second = deferred<ReturnType<typeof quickDocument>>();
      fixture.get.mockReturnValueOnce(first.promise);
      if (retry) {
        fixture.get.mockReturnValueOnce(second.promise);
        fixture.edit.mockResolvedValueOnce({
          ok: false,
          error: {reason: 'stale', message: 'Invented stale write'},
        });
      }
      const editing = saveQuickEdit(fixture.api, {
        kind: 'rename',
        id: quickItem('song').id,
        name: '새 이름',
      });
      const requestId = createAppFlushRequestId(
        '00000000-0000-4000-8000-000000000008',
      );
      try {
        request({requestId});
        await act(async () => undefined);
        expect(flushed).not.toHaveBeenCalled();
        first.resolve(quickDocument());
        if (retry) {
          await waitFor(() => expect(fixture.get).toHaveBeenCalledTimes(2));
          expect(flushed).not.toHaveBeenCalled();
          second.resolve(quickDocument(2));
        }
        await editing;
        await waitFor(() =>
          expect(flushed).toHaveBeenCalledExactlyOnceWith({
            requestId,
            result: true,
          }),
        );
        expect(fixture.edit.mock.invocationCallOrder.at(-1)).toBeLessThan(
          flushed.mock.invocationCallOrder[0] ?? -Infinity,
        );
        const reads = fixture.get.mock.calls.length;
        await expect(
          saveQuickEdit(fixture.api, {
            kind: 'delete',
            id: quickItem('song').id,
          }),
        ).rejects.toThrow();
        expect(fixture.get).toHaveBeenCalledTimes(reads);
      } finally {
        first.resolve(quickDocument());
        second.resolve(quickDocument(2));
        await editing.catch(() => undefined);
        await session.dispose();
      }
    },
  );
  it('closes an applied rename while retaining its disk warning', async () => {
    const fixture = setup();
    failPersistedEdit(fixture.edit);
    fixture.mount();
    fireEvent.contextMenu(
      await screen.findByRole('button', {name: '저장된 곡'}),
    );
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    fireEvent.change(screen.getByRole('textbox', {name: '이름'}), {
      target: {value: '적용된 이름'},
    });
    fireEvent.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(fixture.current().value.items[0]?.name).toBe('적용된 이름');
    expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'warning', title: '퀵 실행 저장 실패'}),
    );
    expect(fixture.edit).toHaveBeenCalledOnce();
  });
  it('accepts an applied addition without retrying and lets close proceed', async () => {
    const fixture = setup();
    failPersistedEdit(fixture.edit);
    const {result} = renderHook(() =>
      useQuickEditing(fixture.api, fixture.problem),
    );
    let accepted = false;
    await act(async () => {
      const adding = result.current.run({
        kind: 'add',
        item: newQuickItem({kind: 'black', name: '검은 화면'}),
      });
      const flushing = pendingWritesOf(fixture.api).flush();
      accepted = await adding;
      expect(await flushing).toBe(true);
    });
    expect(accepted).toBe(true);
    expect(fixture.current().value.items).toHaveLength(8);
    expect(fixture.edit).toHaveBeenCalledOnce();
    expect(fixture.problem).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({kind: 'warning', title: '퀵 실행 저장 실패'}),
    );
  });
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
      await openAddMenu();
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
    await openAddMenu();
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
    await openAddMenu();
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
