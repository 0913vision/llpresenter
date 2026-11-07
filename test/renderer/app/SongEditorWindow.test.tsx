import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {LlpApi} from '@contracts/ipc/api';
import type {ContentEdit} from '@core/schema/contentEdit';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import {
  createServiceItemId,
  createServiceId,
  createSongId,
} from '@core/schema/ids';
import {
  parseServiceDocument,
  type ServiceDocument,
  type ServiceChange,
} from '@core/schema/contentDocuments';
import {ControlSession} from '@renderer/app/controlSession';
import {SongEditorWindow} from '@renderer/app/SongEditorWindow';
import {
  pendingWritesOf,
  type DraftOutcome,
} from '@renderer/platform/pendingWrites';
import {resetTooltips} from '@fixtures/renderer/ui/tooltipTesting';
import {editorFixture} from '@fixtures/renderer/features/songs/editor/editorFixture';
import {lyrics} from '@fixtures/renderer/features/songs/editor/editorTesting';

class MockResizeObserver implements ResizeObserver {
  observe(): void {
    return;
  }
  unobserve(): void {
    return;
  }
  disconnect(): void {
    return;
  }
}

beforeEach(() => {
  resetTooltips();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  vi.stubGlobal('ResizeObserver', MockResizeObserver);
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(
    () => undefined,
  );
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(
    () => undefined,
  );
});

const SERVICE_ID = createServiceId('30000000-0000-4000-8000-000000000001');
const ITEM_ID = createServiceItemId('40000000-0000-4000-8000-000000000001');

function openWindow(target: SongEditorTarget | null) {
  const fixture = editorFixture();
  const retargets = new Set<(target: SongEditorTarget | null) => void>();
  const serviceChanges = new Set<(change: ServiceChange) => void>();
  const service = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '주일 예배',
      date: '2026-11-01T11:00',
      order: [
        {
          slides: fixture.first.song.slides,
          id: ITEM_ID,
          song: fixture.first.song.id,
        },
      ],
    },
    revision: 4,
    access: 'editable',
  });
  if (!service.ok || service.value === null) throw new Error('Bad service');
  let document: ServiceDocument = service.value;
  const edits: ContentEdit[] = fixture.edits;
  const api: LlpApi = {
    ...fixture.api,
    settings: {
      ...fixture.api.settings,
      edit: async edit => {
        const result = await fixture.api.settings.edit(edit);
        if (result.ok && edit.type === 'labels.rename') {
          document = {
            ...document,
            revision: document.revision + 1,
            service: {
              ...document.service,
              order: document.service.order.map(item =>
                'song' in item
                  ? {
                      ...item,
                      slides: item.slides.map(slide =>
                        slide.label === edit.from
                          ? {...slide, label: edit.to}
                          : slide,
                      ),
                    }
                  : item,
              ),
            },
          };
          for (const listener of serviceChanges) {
            listener({serviceId: SERVICE_ID, document});
          }
        }
        return result;
      },
    },
    content: {
      edit: async command => {
        if (command.type !== 'service.update') {
          return fixture.api.content.edit(command);
        }
        if (command.baseRevision !== document.revision) {
          return {
            ok: false,
            error: {reason: 'stale', message: 'Changed service'},
          };
        }
        edits.push(command);
        document = {
          ...document,
          service: command.service,
          revision: document.revision + 1,
        };
        return {ok: true, value: {id: SERVICE_ID, revision: document.revision}};
      },
    },
    songEditorWindow: {
      target: () => Promise.resolve(target),
      onRetarget: listener => {
        retargets.add(listener);
        return () => {
          retargets.delete(listener);
        };
      },
    },
    services: {
      ...fixture.api.services,
      get: () => Promise.resolve(document),
      subscribe: listener => {
        serviceChanges.add(listener);
        return () => {
          serviceChanges.delete(listener);
        };
      },
    },
  };
  window.llp = api;
  const session = new ControlSession(api);
  session.startEditor('manual');
  const view = render(<SongEditorWindow session={session} />);
  afterEach(async () => {
    view.unmount();
    await session.dispose();
    delete window.llp;
  });
  return {
    ...fixture,
    api,
    session,
    edits,
    service: () => document,
    retarget: (next: SongEditorTarget) =>
      act(() => {
        for (const listener of retargets) listener(next);
      }),
  };
}

async function openedWithEdit(target: SongEditorTarget | null = null) {
  const opened = openWindow(target ?? {songId: editorFixture().first.song.id});
  await waitFor(() => expect(lyrics(1)).toBeTruthy());
  fireEvent.change(lyrics(1), {target: {value: '바꾼 가사'}});
  return opened;
}

const FIRST_ID = editorFixture().first.song.id;

afterEach(() => {
  delete window.llp;
});

describe('곡 편집 window', () => {
  it('retains the same item history when returning from its editor to the table', async () => {
    const opened = await openedWithEdit({
      songId: FIRST_ID,
      from: {serviceId: SERVICE_ID, itemId: ITEM_ID},
    });
    const store = opened.session.editor;
    const session = store?.getSnapshot().session;
    if (store === undefined || session == null) throw new Error('Missing item');
    await act(async () => {
      expect(await session.flush()).toBe(true);
    });
    expect(session.history.canUndo).toBe(true);
    act(() => store.requestLeave(() => store.open(null)));
    expect(store.getSnapshot().session).toBeNull();
    expect(store.sessionOf(createSongId(ITEM_ID))).toBe(session);
    expect(session.history.canUndo).toBe(true);
    act(() => session.edit('undo'));
    expect(session.history.snapshot.song.slides[0]?.lines).toEqual(
      opened.first.song.slides[0]?.lines,
    );
  });
  it('settles an untouched new song without creating a file or keeping a draft that blocks close', async () => {
    const opened = openWindow(null);
    act(() => opened.session.editor?.openNew());
    expect(opened.session.editor?.getSnapshot().imported).toBe(true);
    expect(await pendingWritesOf(opened.api).settleDrafts()).toBe('settled');
    expect(opened.session.editor?.getSnapshot().session).toBeNull();
    expect(opened.edits).toHaveLength(0);
    expect(await opened.session.editor?.flush()).toBe(true);
  });

  it('cancels navigation from an edited new song, then discards it through the single close question', async () => {
    const opened = openWindow(null);
    act(() => opened.session.editor?.openNew());
    fireEvent.change(lyrics(1), {target: {value: 'New unsaved lines'}});
    const leave = vi.fn();
    act(() => opened.session.editor?.requestLeave(leave));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '취소',
      }),
    );
    expect(leave).not.toHaveBeenCalled();
    expect(lyrics(1).value).toBe('New unsaved lines');
    const outcome = pendingWritesOf(opened.api).settleDrafts();
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '저장 안 함',
      }),
    );
    expect(await outcome).toBe('settled');
    expect(opened.session.editor?.getSnapshot().session).toBeNull();
    expect(opened.edits).toHaveLength(0);
  });
  it('keeps item lyrics and undo history through a global label rename after saving to the service', async () => {
    const opened = await openedWithEdit({
      songId: FIRST_ID,
      from: {serviceId: SERVICE_ID, itemId: ITEM_ID},
    });
    const store = opened.session.editor;
    const session = store?.getSnapshot().session;
    if (store === undefined || session == null) {
      throw new Error('Missing item editor');
    }
    const readSong = vi.spyOn(opened.api.songs, 'get');
    await act(async () => {
      expect(await store.renameLabel('1절', '오늘')).toBe(true);
    });
    expect(store.getSnapshot().session).toBe(session);
    expect(readSong).not.toHaveBeenCalledWith(createSongId(ITEM_ID));
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      lines: ['바꾼 가사'],
      label: '오늘',
    });
    expect(session.unsaved).toBe(false);
    expect(session.document.revision).toBe(6);
    act(() => {
      session.edit('undo');
    });
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      lines: opened.first.song.slides[0]?.lines,
      label: '오늘',
    });
    act(() => {
      session.edit('redo');
    });
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      lines: ['바꾼 가사'],
      label: '오늘',
    });
    await act(async () => {
      expect(await session.commit()).toBe(true);
    });
    expect(opened.service().service.order[0]).toMatchObject({
      slides: [{lines: ['바꾼 가사'], label: '오늘'}, {}],
    });
    expect(opened.documents.get(FIRST_ID)?.song.slides[0]?.lines).toEqual(
      opened.first.song.slides[0]?.lines,
    );
    await act(async () => {
      expect(await store.renameLabel('오늘', '다음')).toBe(true);
    });
    act(() => {
      session.edit('undo');
    });
    expect(session.history.snapshot.song.slides[0]).toMatchObject({
      lines: opened.first.song.slides[0]?.lines,
      label: '다음',
    });
  });

  it('saves an item lyric only to the service and keeps the library song intact', async () => {
    const opened = await openedWithEdit({
      songId: FIRST_ID,
      from: {serviceId: SERVICE_ID, itemId: ITEM_ID},
    });
    expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
      'readOnly',
      true,
    );
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '저장',
      }),
    );
    await waitFor(() =>
      expect(opened.edits.map(edit => edit.type)).toEqual(['service.update']),
    );
    expect(opened.service().service.order[0]).toMatchObject({
      slides: [{lines: ['바꾼 가사']}, {}],
    });
    expect(opened.documents.get(FIRST_ID)).toEqual(opened.first);
  });
  it('keeps edits in the window with a dot before the title until 저장 asks and overwrites', async () => {
    const {edits, documents} = await openedWithEdit({songId: FIRST_ID});
    expect(screen.getByRole('img', {name: '저장하지 않은 변경'})).toBeTruthy();
    await new Promise(resolve => setTimeout(resolve, 1500));
    expect(edits).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    expect(screen.getByText('‘새 노래 1’ 곡을 덮어쓸까요?')).toBeTruthy();
    expect(edits).toHaveLength(0);

    await userEvent.click(screen.getByRole('button', {name: '덮어쓰기'}));
    await waitFor(() =>
      expect(edits.map(edit => edit.type)).toEqual(['song.update']),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole('img', {name: '저장하지 않은 변경'}),
      ).toBeNull(),
    );
    expect(documents.get(FIRST_ID)?.revision).toBe(2);
  });

  it('cancels the overwrite question without writing', async () => {
    const {edits} = await openedWithEdit({songId: FIRST_ID});
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(edits).toHaveLength(0);
    expect(screen.getByRole('img', {name: '저장하지 않은 변경'})).toBeTruthy();
  });

  it('saves under a new name, leaves the original, and switches the item it came from', async () => {
    const {edits, documents, first, retarget, service} = await openedWithEdit({
      songId: FIRST_ID,
      from: {serviceId: SERVICE_ID, itemId: ITEM_ID},
    });
    await userEvent.click(
      screen.getByRole('button', {name: '다른 이름으로 저장…'}),
    );
    const name = within(await screen.findByRole('dialog')).getByRole('textbox');
    expect(name).toHaveProperty('value', '새 노래 1 복사본');

    await userEvent.keyboard('{Enter}');

    await waitFor(() =>
      expect(edits.map(edit => edit.type)).toEqual([
        'service.update',
        'song.saveAs',
        'service.update',
      ]),
    );
    expect(documents.get(FIRST_ID)).toEqual(first);
    const [, saveAs, update] = edits;
    expect(saveAs).toMatchObject({
      song: {title: '새 노래 1 복사본'},
    });
    expect(update).toMatchObject({
      type: 'service.update',
      baseRevision: 5,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('img', {name: '저장하지 않은 변경'}),
      ).toBeNull(),
    );
    const item = service().service.order[0];
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    if (
      item === undefined ||
      !('song' in item) ||
      typeof item.song !== 'string'
    ) {
      throw new Error('Missing song item');
    }
    retarget({
      songId: createSongId(item.song),
      from: {serviceId: SERVICE_ID, itemId: ITEM_ID},
    });
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
        'readOnly',
        true,
      ),
    );
    fireEvent.change(lyrics(1), {target: {value: '다시 바꾼 가사'}});
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '저장',
      }),
    );
    await waitFor(() =>
      expect(service().service.order[0]).toMatchObject({
        slides: [{lines: ['다시 바꾼 가사']}, {}],
      }),
    );
    expect(documents.get(FIRST_ID)).toEqual(first);
  });

  it('refuses a name another song has before sending anything', async () => {
    const {edits, second} = await openedWithEdit({songId: FIRST_ID});
    await userEvent.click(
      screen.getByRole('button', {name: '다른 이름으로 저장…'}),
    );
    const name = within(await screen.findByRole('dialog')).getByRole('textbox');
    await userEvent.clear(name);
    await userEvent.type(name, `${second.song.title}{Enter}`);
    expect(edits).toHaveLength(0);
  });

  it('keeps the edits and says so when the save fails', async () => {
    const opened = await openedWithEdit({songId: FIRST_ID});
    vi.spyOn(opened.api.content, 'edit').mockResolvedValue({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    await userEvent.click(screen.getByRole('button', {name: '저장'}));
    await userEvent.click(screen.getByRole('button', {name: '덮어쓰기'}));
    expect(await screen.findAllByText('곡 저장 실패')).not.toHaveLength(0);
    expect(screen.getByRole('img', {name: '저장하지 않은 변경'})).toBeTruthy();
    expect(lyrics(1)).toHaveProperty('value', '바꾼 가사');
  });

  it('asks before moving to another song with unsaved edits, and moves on 저장 안 함', async () => {
    const opened = await openedWithEdit({songId: FIRST_ID});

    opened.retarget({songId: opened.second.song.id});

    await screen.findByText('‘새 노래 1’ 곡의 변경을 저장할까요?');
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(lyrics(1)).toHaveProperty('value', '바꾼 가사');

    opened.retarget({songId: opened.second.song.id});
    await userEvent.click(
      await screen.findByRole('button', {name: '저장 안 함'}),
    );
    await waitFor(() =>
      expect(screen.getByRole('textbox', {name: '곡 제목'})).toHaveProperty(
        'value',
        '새 노래 2',
      ),
    );
    expect(opened.edits).toHaveLength(0);
  });

  it('asks 저장, 저장 안 함, 취소 when the window closes with unsaved edits', async () => {
    const opened = await openedWithEdit({songId: FIRST_ID});
    const outcome = pendingWritesOf(opened.api).settleDrafts();

    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '저장',
      }),
    );

    expect(await outcome).toBe('settled');
    expect(opened.edits.map(edit => edit.type)).toEqual(['song.update']);
  });

  it('lets the close go on without asking when nothing changed', async () => {
    const opened = openWindow({songId: FIRST_ID});
    await waitFor(() => expect(lyrics(1)).toBeTruthy());

    expect(await pendingWritesOf(opened.api).settleDrafts()).toBe('settled');
    expect(opened.edits).toHaveLength(0);
  });
  it('puts the cursor in the title field when the target asks for it', async () => {
    openWindow({songId: FIRST_ID, focusTitle: true});
    const title = await screen.findByRole('textbox', {name: '곡 제목'});
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('cancels the close question that a second request replaces', async () => {
    const opened = await openedWithEdit({songId: FIRST_ID});
    const first = pendingWritesOf(opened.api).settleDrafts();
    await screen.findByRole('alertdialog');

    const second = pendingWritesOf(opened.api).settleDrafts();

    expect(await first).toBe('canceled');
    await userEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: '취소',
      }),
    );
    expect(await second).toBe('canceled');
  });

  it('cancels the first close request when two arrive before a render', async () => {
    const opened = await openedWithEdit({songId: FIRST_ID});
    const pending = pendingWritesOf(opened.api);
    const outcomes: Array<Promise<DraftOutcome>> = [];

    act(() => {
      outcomes.push(pending.settleDrafts(), pending.settleDrafts());
    });

    await expect(outcomes[0]).resolves.toBe('canceled');
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: '취소',
      }),
    );
    await expect(outcomes[1]).resolves.toBe('canceled');
  });
});
