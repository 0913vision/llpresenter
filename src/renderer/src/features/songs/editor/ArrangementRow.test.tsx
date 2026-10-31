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
import {editorSetup} from './editorTesting';
import {editorFixture, editorGroupedSong, editorSong} from './editorFixture';
import {SongSession} from './songSession';
import {SongEditorStore} from './songEditorStore';
import {ArrangementRow} from './ArrangementRow';

describe('arrangement row', () => {
  it('opens editing beside one named arrangement and drags its groups without changing the source', async () => {
    const {user, session} = await editorSetup();
    const source = session.history.snapshot.song.groups;
    await user.click(screen.getByRole('radio', {name: '주일용'}));
    const before = [...(session.arrangementGroups ?? [])];
    await user.click(screen.getByRole('button', {name: '구성 편집…'}));
    const strip = screen.getByRole('group', {name: '구성 편집'});
    expect(document.activeElement).toBe(strip);
    await user.click(within(strip).getByRole('button', {name: '그룹 넣기'}));
    const insertMenu = screen.getByRole('menu', {name: '그룹 넣기'});
    expect(
      [
        ...insertMenu.querySelectorAll('[role="menuitem"], [role="separator"]'),
      ].map(row => row.textContent),
    ).toEqual(['1절', '후렴']);
    fireEvent.keyDown(insertMenu, {key: 'Escape'});
    const chips = within(strip).getAllByRole('option');
    chips.forEach((chip, index) => {
      vi.spyOn(chip, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(index * 60, 0, 52, 30),
      );
    });
    const chip = chips[0];
    if (!chip) throw new Error('Missing group chip');
    const pointer = {pointerId: 7, button: 0, clientY: 15};
    fireEvent.pointerDown(chip, {...pointer, clientX: 10});
    fireEvent.pointerMove(window, {...pointer, clientX: 400});
    expect(chip.getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerUp(window, {...pointer, clientX: 400});
    expect(session.arrangementGroups).toEqual([...before.slice(1), before[0]]);
    expect(session.history.snapshot.song.groups).toEqual(source);
    await user.click(screen.getByRole('radio', {name: '기본'}));
    expect(document.activeElement).toBe(
      screen.getByRole('radio', {name: '기본'}),
    );
  });

  it('keeps cancellation free of edits and lists the management rows including default protection', async () => {
    const {user, session, edits} = await editorSetup();
    await user.click(screen.getByRole('button', {name: '구성 추가'}));
    await user.click(screen.getByRole('button', {name: '취소'}));
    expect(session.history.snapshot.song.arrangements).toHaveLength(1);
    expect(edits).toHaveLength(0);
    const contextTarget = screen.getByRole('radio', {name: '기본'});
    fireEvent.contextMenu(contextTarget);
    expect(contextTarget.hasAttribute('data-menu-target')).toBe(true);
    const menu = screen.getByRole('menu', {name: '구성 관리'});
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual(['복제', '이름 바꾸기', '|', '삭제']);
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .every(row => row.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);
  });

  it('lists picker rows in order and opens the song arrangement strip for editing', async () => {
    const fixture = editorFixture();
    const first = {
      ...fixture.first,
      song: {
        ...fixture.first.song,
        arrangements: Array.from({length: 5}, (_, index) => ({
          name: `구성 ${index + 1}`,
          groups: fixture.first.song.groups.map(group => group.id),
        })),
      },
    };
    fixture.documents.set(first.song.id, first);
    const {user, session} = await editorSetup({...fixture, first});
    await user.click(screen.getByRole('button', {name: '구성'}));
    const menu = screen.getByRole('menu', {name: '구성'});
    expect(
      [...menu.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '기본',
      '|',
      '구성 1',
      '구성 2',
      '구성 3',
      '구성 4',
      '구성 5',
      '|',
      '새 구성…',
      '구성 편집…',
    ]);
    await user.click(within(menu).getByRole('menuitemradio', {name: '구성 1'}));
    await user.click(screen.getByRole('button', {name: '구성'}));
    await user.click(screen.getByRole('menuitem', {name: '구성 편집…'}));
    const strip = screen.getByRole('group', {name: '구성 편집'});
    expect(document.activeElement).toBe(strip);
    const chips = within(strip).getAllByRole('option');
    const firstChip = chips[0];
    if (!firstChip) throw new Error('Missing chip');
    await user.click(firstChip);
    await user.keyboard('{Delete}');
    expect(session.arrangementGroups).toHaveLength(
      first.song.groups.length - 1,
    );
    expect(session.history.snapshot.song.groups).toEqual(first.song.groups);
  });

  it('creates a named copy after confirmation and restores focus', async () => {
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
          .getByRole('button', {name: '확인'})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    }
    fireEvent.change(field, {target: {value: '  저녁용  '}});
    await user.click(screen.getByRole('button', {name: '확인'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(session.arrangement).toBe('저녁용');
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    expect(edits.some(edit => edit.type === 'song.arrangement.rename')).toBe(
      false,
    );
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
          groups: fixture.first.song.groups.map(group => group.id).toReversed(),
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
    const session = new SongSession({
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
    expect(session.arrangement).toBe('주일용');
    await user.click(screen.getByRole('button', {name: '확인'}));
    expect(session.arrangement).toBe('구성 1');
    const song = session.history.snapshot.song;
    const arrangement = song.arrangements?.find(a => a.name === '주일용');
    if (arrangement === undefined || !('groups' in arrangement)) {
      throw new Error('Expected grouped arrangement');
    }
    expect(session.arrangementGroups).toEqual(arrangement.groups);
  });
});
