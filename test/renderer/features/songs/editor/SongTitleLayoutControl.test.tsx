import {act, fireEvent, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {editorSetup} from '@fixtures/renderer/features/songs/editor/editorTesting';

it.each([
  ['제목 자간', 'titleTracking', 0],
  ['부제 자간', 'subtitleTracking', 24],
  ['제목 위쪽', 'titleTop', 181],
  ['부제 위쪽', 'subtitleTop', 345],
] as const)(
  'undoes and redoes %s without leaving the field',
  async (label, key, initial) => {
    const {session, user} = await editorSetup();
    act(() => session.edit({type: 'title', title: 'Invented title'}));
    const before = session.history.snapshot.song.slides;
    const field = screen.getByRole('spinbutton', {name: label});
    await user.click(field);
    await user.keyboard('{ArrowUp}');
    const after = session.history.snapshot.song.slides;
    expect(after[0]?.titleLayout?.[key]).toBe(initial + 1);
    expect(field).toHaveProperty('value', String(initial + 1));

    fireEvent.keyDown(field, {key: 'z', ctrlKey: true, isComposing: true});
    fireEvent.keyDown(field, {key: 'z', ctrlKey: true, altKey: true});
    expect(session.history.snapshot.song.slides).toEqual(after);

    await user.keyboard('{Control>}z{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(before);
    expect(field).toHaveProperty('value', String(initial));
    expect(document.activeElement).toBe(field);

    await user.keyboard('{Control>}y{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(after);
    expect(field).toHaveProperty('value', String(initial + 1));
    await user.keyboard('{Control>}z{/Control}');
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(session.history.snapshot.song.slides).toEqual(after);
    expect(field).toHaveProperty('value', String(initial + 1));
    expect(document.activeElement).toBe(field);
  },
);
