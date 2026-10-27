import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import userEvent from '@testing-library/user-event';
import type {GroupedSong} from '@shared/schema/groupedSong';
import {editorSetup} from './editorTesting';
import {editorFixture, editorGroupedSong, editorSong} from './editorFixture';
import {SongSession} from './songSession';
import {SongEditorStore} from './songEditorStore';
import {ArrangementRow} from './ArrangementRow';

describe('arrangement row', () => {
  it('creates a copy, selects its name, validates, renames through main, and restores focus', async () => {
    const {user, session, edits} = await editorSetup();
    await user.click(screen.getByRole('radio', {name: '주일용'}));
    await user.click(screen.getByRole('button', {name: '구성 추가'}));
    const field = screen.getByRole('textbox', {name: '구성 이름'});
    expect(document.activeElement).toBe(field);
    if (!(field instanceof HTMLInputElement)) {
      throw new Error('Missing name field');
    }
    expect(field.value).toBe('구성 1');
    expect(field.selectionStart).toBe(0);
    expect(field.selectionEnd).toBe(field.value.length);
    for (const value of ['', '기본', '주일용']) {
      fireEvent.change(field, {target: {value}});
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(
        screen
          .getByRole('button', {name: '저장'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    }
    fireEvent.change(field, {target: {value: '  저녁용  '}});
    await user.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(session.arrangement).toBe('저녁용');
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    expect(edits.at(-1)).toMatchObject({
      type: 'song.arrangement.rename',
      from: '구성 1',
      to: '저녁용',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '구성 추가'}),
    );
  });

  it('manages an unselected segment by keyboard and protects the default', async () => {
    const {user, session, edits} = await editorSetup();
    const named = screen.getByRole('radio', {name: '주일용'});
    act(() => named.focus());
    fireEvent.keyDown(named, {key: 'F10', shiftKey: true});
    await user.click(screen.getByRole('menuitem', {name: '이름 바꾸기'}));
    fireEvent.change(screen.getByRole('textbox', {name: '구성 이름'}), {
      target: {value: '새 이름'},
    });
    await user.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(session.arrangement).toBeUndefined();
    fireEvent.contextMenu(screen.getByRole('radio', {name: '새 이름'}), {
      clientX: 30,
      clientY: 20,
    });
    await user.click(screen.getByRole('menuitem', {name: '삭제'}));
    await waitFor(() =>
      expect(screen.queryByRole('radio', {name: '새 이름'})).toBeNull(),
    );
    expect(edits.at(-1)).toMatchObject({
      type: 'song.arrangement.delete',
      name: '새 이름',
    });
    const base = screen.getByRole('radio', {name: '기본'});
    fireEvent.keyDown(base, {key: 'ContextMenu'});
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      screen
        .getByRole('menuitem', {name: '이름 바꾸기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
    expect(document.activeElement).toBe(base);
  });

  it('uses Select above five options and permits read-only selection', async () => {
    const fixture = editorFixture();
    const first = {
      ...editorSong(1, 'readOnly'),
      song: {
        ...fixture.first.song,
        arrangements: Array.from({length: 5}, (_, index) => ({
          name: `구성 ${index + 1}`,
          slides: [2, 1],
        })),
      },
    };
    fixture.documents.set(first.song.id, first);
    const {user, session} = await editorSetup({...fixture, first});
    const select = screen.getByRole('button', {name: '구성'});
    await user.click(select);
    await user.click(
      within(screen.getByRole('menu', {name: '구성'})).getByRole(
        'menuitemradio',
        {name: '구성 5'},
      ),
    );
    expect(session.arrangement).toBe('구성 5');
    expect(
      screen
        .getByRole('button', {name: '구성 추가'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    fireEvent.contextMenu(select);
    expect(
      screen
        .getByRole('menuitem', {name: '삭제'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('manages named arrangements referencing groups on grouped songs', async () => {
    const fixture = editorFixture();
    const store = new SongEditorStore(fixture.api, vi.fn());
    const user = userEvent.setup();
    const session = new SongSession<GroupedSong>({
      document: editorGroupedSong(1),
      api: fixture.api.content,
      changed: vi.fn(),
      problem: vi.fn(),
    });
    const view = render(<ArrangementRow store={store} session={session} />);

    expect(
      within(view.container).getByRole('radio', {name: '기본'}),
    ).toBeDefined();
    expect(
      within(view.container).getByRole('radio', {name: '주일용'}),
    ).toBeDefined();

    await user.click(
      within(view.container).getByRole('radio', {name: '주일용'}),
    );
    expect(session.arrangement).toBe('주일용');
    expect(session.arrangementSlides).toEqual([1, 2, 3, 1, 2]);

    await user.click(
      within(view.container).getByRole('button', {name: '구성 추가'}),
    );
    expect(session.arrangement).toBe('구성 1');
    const song = session.history.snapshot.song;
    const arrangement = song.arrangements?.find(a => a.name === '주일용');
    if (arrangement === undefined || !('groups' in arrangement)) {
      throw new Error('Expected grouped arrangement');
    }
    expect(session.arrangementGroups).toEqual(arrangement.groups);
  });
});
