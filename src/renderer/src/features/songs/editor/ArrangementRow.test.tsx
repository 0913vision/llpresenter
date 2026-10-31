import {act, fireEvent, screen, waitFor, within} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import type {UserEvent} from '@testing-library/user-event';
import {editorSetup} from './editorTesting';
import {editorFixture, editorSong} from './editorFixture';
import {hoverForTooltip} from '@renderer/ui/tooltipTesting';

async function menu(user: UserEvent): Promise<HTMLElement> {
  await user.click(screen.getByRole('button', {name: '구성'}));
  return screen.getByRole('menu', {name: '구성'});
}

async function choose(user: UserEvent, name: string): Promise<void> {
  await user.click(within(await menu(user)).getByRole('menuitemradio', {name}));
}

describe('arrangement row', () => {
  it('retains an applied rename in the mounted editor and retries persistence without renaming twice', async () => {
    const fixture = editorFixture();
    const edit = fixture.api.content.edit;
    let failed = false;
    const write = vi
      .spyOn(fixture.api.content, 'edit')
      .mockImplementation(async command => {
        const result = await edit(command);
        if (command.type === 'song.arrangement.rename' && !failed) {
          failed = true;
          if (!result.ok) throw new Error('Fixture rename did not apply');
          return {
            ok: false,
            error: {
              reason: 'write-failed',
              message: 'Invented disk failure',
              applied: result.value,
              unchangedFiles: ['fixture.json'],
            },
          };
        }
        return result;
      });
    const {user, session} = await editorSetup(fixture);
    await choose(user, '주일용');
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '이름 바꾸기…'}),
    );
    const field = screen.getByRole('textbox', {name: '구성 이름'});
    fireEvent.change(field, {target: {value: '새 이름'}});
    await user.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() =>
      expect(field.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(session.arrangement).toBe('새 이름');
    expect(screen.getByRole('textbox', {name: '구성 이름'})).toBe(field);
    await user.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      write.mock.calls.filter(
        ([command]) => command.type === 'song.arrangement.rename',
      ),
    ).toHaveLength(1);
    expect(
      write.mock.calls.some(([command]) => command.type === 'saves.retry'),
    ).toBe(true);
  });
  it('does not carry source arrangement dialogs into an imported song', async () => {
    const {user, store} = await editorSetup();
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '새 구성…'}),
    );
    expect(screen.getByRole('dialog')).toBeDefined();
    act(() =>
      store.openImported({
        title: 'Invented import',
        slides: [{label: '1절', lines: ['Invented words']}],
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(
      screen.getByRole('textbox', {name: '곡 제목'}).getAttribute('value'),
    ).toBe('Invented import');
  });
  it('uses one dropdown for a single named choice and protects the default with a reason', async () => {
    const {user, edits} = await editorSetup();
    expect(screen.queryByRole('radio', {name: '기본'})).toBeNull();
    const list = await menu(user);
    expect(
      [...list.querySelectorAll('[role^="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '기본',
      '|',
      '주일용',
      '|',
      '새 구성…',
      '이름 바꾸기…',
      '지우기',
      '|',
      '구성 편집…',
    ]);
    const rename = within(list).getByRole('menuitem', {name: '이름 바꾸기…'});
    expect(rename.getAttribute('aria-disabled')).toBe('true');
    expect(
      within(list)
        .getByRole('menuitem', {name: '지우기'})
        .getAttribute('aria-disabled'),
    ).toBe('true');
    expect(edits).toEqual([]);
    expect((await hoverForTooltip(rename))?.textContent).toBe(
      '기본 구성은 바꿀 수 없습니다',
    );
  });

  it('opens the source strip and drags groups without changing source lyrics', async () => {
    const {user, session} = await editorSetup();
    const source = session.history.snapshot.song.groups;
    await choose(user, '주일용');
    const before = [...(session.arrangementGroups ?? [])];
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '구성 편집…'}),
    );
    const strip = screen.getByRole('group', {name: '구성 편집'});
    expect(document.activeElement).toBe(strip);
    const chips = within(strip).getAllByRole('option');
    chips.forEach((chip, index) =>
      vi
        .spyOn(chip, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(index * 60, 0, 52, 30)),
    );
    const first = chips[0];
    if (!first) throw new Error('Missing group chip');
    const pointer = {pointerId: 7, button: 0, clientY: 15};
    fireEvent.pointerDown(first, {...pointer, clientX: 10});
    fireEvent.pointerMove(window, {...pointer, clientX: 400});
    expect(first.getAttribute('data-dragging')).toBe('true');
    fireEvent.pointerUp(window, {...pointer, clientX: 400});
    expect(session.arrangementGroups).toEqual([...before.slice(1), before[0]]);
    expect(session.history.snapshot.song.groups).toEqual(source);
    const movedFirst = within(strip).getAllByRole('option')[0];
    if (!movedFirst) throw new Error('Missing moved chip');
    await user.click(movedFirst);
    await user.keyboard('{Delete}');
    expect(session.arrangementGroups).toHaveLength(before.length - 1);
    await user.click(within(strip).getByRole('button', {name: '그룹 넣기'}));
    await user.click(screen.getByRole('menuitem', {name: '1절'}));
    expect(session.arrangementGroups).toHaveLength(before.length);
  });

  it('validates a named copy, leaves cancellation clean, and restores the picker focus', async () => {
    const {user, session, edits} = await editorSetup();
    await choose(user, '주일용');
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '새 구성…'}),
    );
    await user.click(screen.getByRole('button', {name: '취소'}));
    expect(edits).toEqual([]);
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '새 구성…'}),
    );
    const field = screen.getByRole('textbox', {name: '구성 이름'});
    expect(document.activeElement).toBe(field);
    for (const value of ['', '기본', '주일용']) {
      fireEvent.change(field, {target: {value}});
      expect(field.getAttribute('aria-invalid')).toBe('true');
    }
    fireEvent.change(field, {target: {value: '  저녁용  '}});
    await user.click(screen.getByRole('button', {name: '확인'}));
    expect(session.arrangement).toBe('저녁용');
    expect(session.arrangementSlides).toEqual([1, 2, 2]);
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '구성'}),
    );
  });

  it('renames and removes the selected named arrangement through the song writer', async () => {
    const {user, session, edits} = await editorSetup();
    await choose(user, '주일용');
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '이름 바꾸기…'}),
    );
    fireEvent.change(screen.getByRole('textbox', {name: '구성 이름'}), {
      target: {value: '새 이름'},
    });
    await user.click(screen.getByRole('button', {name: '저장'}));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(session.arrangement).toBe('새 이름');
    await user.click(
      within(await menu(user)).getByRole('menuitem', {name: '지우기'}),
    );
    await waitFor(() => expect(session.arrangement).toBeUndefined());
    expect(edits.at(-1)).toMatchObject({
      type: 'song.arrangement.delete',
      name: '새 이름',
    });
  });

  it('keeps read-only order selection available while disabling source mutations', async () => {
    const fixture = editorFixture();
    const first = {...editorSong(1, 'readOnly'), song: fixture.first.song};
    fixture.documents.set(first.song.id, first);
    const {user, session} = await editorSetup({...fixture, first});
    await choose(user, '주일용');
    expect(session.arrangement).toBe('주일용');
    const list = await menu(user);
    for (const name of ['새 구성…', '이름 바꾸기…', '지우기']) {
      expect(
        within(list)
          .getByRole('menuitem', {name})
          .getAttribute('aria-disabled'),
      ).toBe('true');
    }
    fireEvent.keyDown(list, {key: 'Escape'});
    act(() => session.selectArrangement(undefined));
  });
});
