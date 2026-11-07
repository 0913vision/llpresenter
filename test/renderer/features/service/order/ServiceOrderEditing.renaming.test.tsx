import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {useHeaderRename} from '@renderer/session/headerRename';
import {
  headerId,
  firstId,
  lastId,
  secondHeaderId,
  setup,
  transfer,
} from '@fixtures/renderer/features/service/order/serviceOrderEditingFixtures';

describe('service panel editing', () => {
  it.each([
    {y: 14, expected: [headerId, firstId, lastId, secondHeaderId]},
    {y: 15, expected: [secondHeaderId, headerId, firstId, lastId]},
    {y: 16, expected: [secondHeaderId, headerId, firstId, lastId]},
  ])(
    'moves a whole section across the target header midpoint at $y',
    async ({y, expected}) => {
      const {ids} = setup('prep', false, {secondSection: true});
      const target = screen.getByRole('option', {name: '마무리'});
      vi.spyOn(target, 'getBoundingClientRect').mockReturnValue(
        new DOMRect(0, 0, 200, 30),
      );
      const dataTransfer = transfer();
      fireEvent.dragStart(screen.getByText('제목'), {dataTransfer});
      const event = new Event('drop', {bubbles: true, cancelable: true});
      Object.defineProperties(event, {
        dataTransfer: {value: dataTransfer},
        clientY: {value: y},
      });
      fireEvent(target, event);
      await waitFor(() => expect(ids()).toEqual(expected));
    },
  );

  it('renames a header in place with a double click, Enter, Esc, and leaving the field', async () => {
    const {api, ids, send} = setup('prep');
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, {target: {value: '  말씀  '}});
    fireEvent.keyDown(field, {key: 'Enter'});
    await waitFor(() => expect(screen.getByText('말씀')).toBeDefined());
    expect(ids()).toEqual([headerId, firstId, lastId]);
    fireEvent.doubleClick(screen.getByText('말씀'));
    fireEvent.change(screen.getByRole('textbox', {name: '말씀 이름'}), {
      target: {value: '버림'},
    });
    fireEvent.keyDown(screen.getByRole('textbox', {name: '말씀 이름'}), {
      key: 'Escape',
    });
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('말씀')).toBeDefined();
    fireEvent.doubleClick(screen.getByText('말씀'));
    const again = screen.getByRole('textbox', {name: '말씀 이름'});
    fireEvent.change(again, {target: {value: '마무리'}});
    fireEvent.blur(again);
    await waitFor(() => expect(screen.getByText('마무리')).toBeDefined());
    expect(api.content.edit).toHaveBeenCalledTimes(2);
    expect(send).not.toHaveBeenCalled();
  });

  it('leaves text editing keys to the rename field', async () => {
    const {api, ids} = setup('prep');
    fireEvent.click(screen.getByRole('option', {name: '첫 곡'}));
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    for (const key of [
      {code: 'KeyZ', key: 'z', ctrlKey: true},
      {code: 'KeyY', key: 'y', ctrlKey: true},
      {code: 'Delete', key: 'Delete'},
      {code: 'Home', key: 'Home'},
      {code: 'End', key: 'End'},
    ]) {
      fireEvent.keyDown(field, key);
      expect(document.activeElement).toBe(field);
    }
    expect(api.content.edit).not.toHaveBeenCalled();
    expect(ids()).toEqual([headerId, firstId, lastId]);
    expect(
      screen.getByRole('option', {name: '첫 곡'}).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('still lets window commands such as Ctrl L and the F keys through the rename field', () => {
    setup('prep');
    fireEvent.doubleClick(screen.getByText('제목'));
    const field = screen.getByRole('textbox', {name: '제목 이름'});
    const reached: string[] = [];
    const listener = (event: KeyboardEvent): void => {
      reached.push(event.code);
    };
    window.addEventListener('keydown', listener);
    fireEvent.keyDown(field, {code: 'KeyL', key: 'l', ctrlKey: true});
    fireEvent.keyDown(field, {code: 'F2', key: 'F2'});
    fireEvent.keyDown(field, {code: 'KeyZ', key: 'z', ctrlKey: true});
    fireEvent.keyDown(field, {code: 'Home', key: 'Home'});
    window.removeEventListener('keydown', listener);
    expect(reached).toEqual(['KeyL', 'F2']);
  });

  it('opens the rename field only from the header itself, not from its items', () => {
    setup('prep');
    fireEvent.doubleClick(screen.getByRole('option', {name: '첫 곡'}));
    expect(screen.queryByRole('textbox')).toBeNull();
    fireEvent.doubleClick(screen.getByText('제목'));
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
  });

  it('keeps the old name for a blank one and opens the field from the menu', async () => {
    const {api} = setup();
    fireEvent.contextMenu(screen.getByText('제목'));
    fireEvent.click(await screen.findByRole('menuitem', {name: '이름 바꾸기'}));
    const field = await screen.findByRole('textbox', {name: '제목 이름'});
    fireEvent.change(field, {target: {value: '   '}});
    fireEvent.keyDown(field, {key: 'Enter'});
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.blur(field);
    await waitFor(() => expect(screen.queryByRole('textbox')).toBeNull());
    expect(screen.getByText('제목')).toBeDefined();
    expect(api.content.edit).not.toHaveBeenCalled();
    fireEvent.contextMenu(screen.getByRole('option', {name: '첫 곡'}));
    expect(await screen.findByRole('menuitem', {name: '삭제'})).toBeDefined();
    expect(screen.queryByRole('menuitem', {name: '이름 바꾸기'})).toBeNull();
  });

  it('opens the field of a header that quick add asked for once it is listed', async () => {
    setup();
    useHeaderRename
      .getState()
      .request(createServiceItemId('10000000-0000-4000-8000-0000000000aa'));
    expect(screen.queryByRole('textbox')).toBeNull();
    act(() => useHeaderRename.getState().request(headerId));
    expect(screen.getByRole('textbox', {name: '제목 이름'})).toBeDefined();
    fireEvent.keyDown(screen.getByRole('textbox', {name: '제목 이름'}), {
      key: 'Escape',
    });
    expect(useHeaderRename.getState().requested).toBeNull();
  });

  it('does not rename in a read-only service', () => {
    setup('show', true);
    fireEvent.doubleClick(screen.getByText('제목'));
    expect(screen.queryByRole('textbox')).toBeNull();
  });
});
