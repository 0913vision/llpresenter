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
import {createServiceItemId, createServiceId} from '@core/schema/ids';
import {parseServiceDocument} from '@core/schema/contentDocuments';
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
});

const SERVICE_ID = createServiceId('30000000-0000-4000-8000-000000000001');
const ITEM_ID = createServiceItemId('40000000-0000-4000-8000-000000000001');

function openWindow(target: SongEditorTarget | null) {
  const fixture = editorFixture();
  const retargets = new Set<(target: SongEditorTarget | null) => void>();
  const service = parseServiceDocument({
    service: {
      format: 'llservice',
      schemaVersion: 1,
      id: SERVICE_ID,
      name: '주일 예배',
      date: '2026-11-01T11:00',
      order: [{id: ITEM_ID, song: fixture.first.song.id}],
    },
    revision: 4,
    access: 'editable',
  });
  if (!service.ok || service.value === null) throw new Error('Bad service');
  const document = service.value;
  const edits: ContentEdit[] = fixture.edits;
  const api: LlpApi = {
    ...fixture.api,
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
    },
  };
  window.llp = api;
  const session = new ControlSession(api);
  session.startEditor('manual');
  const view = render(<SongEditorWindow session={session} />);
  afterEach(() => {
    view.unmount();
    delete window.llp;
  });
  return {
    ...fixture,
    api,
    session,
    edits,
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
    const {edits, documents, first} = await openedWithEdit({
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
        'song.saveAs',
        'service.update',
      ]),
    );
    expect(documents.get(FIRST_ID)).toEqual(first);
    const [saveAs, update] = edits;
    expect(saveAs).toMatchObject({
      song: {title: '새 노래 1 복사본'},
    });
    expect(update).toMatchObject({
      type: 'service.update',
      baseRevision: 4,
    });
    await waitFor(() =>
      expect(
        screen.queryByRole('img', {name: '저장하지 않은 변경'}),
      ).toBeNull(),
    );
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
