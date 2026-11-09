import {createRef} from 'react';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import type {SongEditorTarget} from '@core/schema/ipcPayloads';
import {createSongId} from '@core/schema/ids';
import {
  fixtureItems,
  fixtureServiceId,
  itemFixture,
} from '@fixtures/renderer/features/service/items/itemFixture';
import {InlineSongController} from '@renderer/features/songs/editor/InlineSongController';
import {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';
import {SongEditor} from '@renderer/features/songs/editor/SongEditor';

it('leaves a lyric field with Escape before guarding a dirty library song exit', async () => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
  const fixture = itemFixture();
  const store = new SongEditorStore(fixture.api, vi.fn(), 'manual');
  const view = render(
    <>
      <InlineSongController
        store={store}
        api={fixture.api}
        controls={createRef<SongEditorWindowModel>()}
        report={vi.fn()}
        onOpen={vi.fn()}
      />
      <SongEditor
        store={store}
        onBack={() => store.requestLeave(() => store.open(null))}
      />
    </>,
  );
  try {
    act(() => store.open(fixture.first));
    const input = await screen.findByRole<HTMLTextAreaElement>('textbox', {
      name: '슬라이드 2 가사',
    });
    await userEvent.click(input);
    await userEvent.keyboard(' Added');
    const text = input.value;
    fireEvent.keyDown(input, {
      key: 'Escape',
      code: 'Escape',
      isComposing: true,
    });
    expect(document.activeElement).toBe(input);
    await userEvent.keyboard('{Escape}');
    expect(document.activeElement).toBe(
      screen.getByRole('group', {name: '슬라이드 편집 명령'}),
    );
    expect(input.value).toBe(text);
    const selected = document.querySelectorAll(
      '[data-song-slide][data-active="true"]',
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.getAttribute('data-editor-block')).toBe('1');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await userEvent.keyboard('{Escape}');
    await screen.findByRole('alertdialog');
    expect(store.getSnapshot().session).not.toBeNull();
    await userEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(input.value).toBe(text);
    expect(fixture.edits).toHaveLength(0);
  } finally {
    view.unmount();
    await store.dispose();
  }
});

it('follows an item target only after accepting the current library draft leave question', async () => {
  const fixture = itemFixture();
  const listeners = new Set<(target: SongEditorTarget | null) => void>();
  vi.spyOn(fixture.api.songEditorWindow, 'onRetarget').mockImplementation(
    listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  );
  const store = new SongEditorStore(fixture.api, vi.fn(), 'manual');
  const opened = vi.fn();
  const view = render(
    <InlineSongController
      store={store}
      api={fixture.api}
      controls={createRef<SongEditorWindowModel>()}
      report={vi.fn()}
      onOpen={opened}
    />,
  );
  try {
    act(() => store.open(fixture.first));
    const session = store.getSnapshot().session;
    if (session === null) throw new Error('Missing library session');
    act(() =>
      session.edit({
        type: 'text',
        text: 'Invented unsaved lines',
        start: 0,
        end: 0,
      }),
    );
    const target: SongEditorTarget = {
      songId: fixture.first.song.id,
      from: {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      block: 1,
    };
    const retarget = (): void => {
      act(() => {
        for (const listener of listeners) listener(target);
      });
    };
    retarget();
    await screen.findByRole('alertdialog');
    expect(opened).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', {name: '취소'}));
    expect(store.getSnapshot().session).toBe(session);
    expect(opened).not.toHaveBeenCalled();
    retarget();
    fireEvent.click(screen.getByRole('button', {name: '저장 안 함'}));
    await waitFor(() => expect(opened).toHaveBeenCalledExactlyOnceWith(target));
    expect(store.getSnapshot().session?.document.song.id).toBe(
      createSongId(fixtureItems.arranged),
    );
    expect(store.getSnapshot().session?.selectedOccurrence).toBe(1);
  } finally {
    view.unmount();
    await store.dispose();
  }
  expect(listeners.size).toBe(0);
});
