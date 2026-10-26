import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {
  BibleLookupReply,
  BibleLookupRequest,
} from '@shared/schema/bibleLookup';
import {BibleReferenceField} from './BibleReferenceField';
import {lookupReply, lookupRequest} from './testBible';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function setup(count = 0) {
  const lookup = vi.fn(async (request: BibleLookupRequest) =>
    lookupReply(request),
  );
  const onPreview = vi.fn();
  const onShow = vi.fn();
  const api = {lookup};
  const recents = Array.from({length: count}, (_, index) => ({
    ref: `창세기 1:${index + 1}`,
    translation: lookupRequest().translation,
  }));
  const view = render(
    <BibleReferenceField
      api={api}
      translation={lookupRequest().translation}
      recents={recents}
      onPreview={onPreview}
      onShow={onShow}
    />,
  );
  return {
    ...view,
    lookup,
    api,
    onPreview,
    onShow,
    field: screen.getByRole<HTMLInputElement>('combobox'),
    user: userEvent.setup(),
  };
}

describe('Bible reference field', () => {
  it('previews valid input without output and sends the passage on Enter', async () => {
    const {field, onShow, onPreview, user} = setup();
    await user.type(field, '요 3:16');
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    expect(onShow).not.toHaveBeenCalled();
    expect(screen.getByRole('option').textContent).toContain('요한복음 3:16');
    expect(screen.getByRole('option').textContent).toContain('1절');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onShow).toHaveBeenCalledWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
    expect(document.activeElement).toBe(field);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('chooses a different pointed recent before allowing output and caps recents at ten', async () => {
    const {field, onShow, user} = setup(15);
    await user.click(field);
    expect(screen.getAllByRole('option')).toHaveLength(10);
    await user.keyboard('{ArrowDown}');
    expect(field.getAttribute('aria-activedescendant')).not.toBeNull();
    await user.keyboard('{Enter}');
    expect(field.value).toBe('창세기 1:1');
    expect(onShow).not.toHaveBeenCalled();
    await waitFor(() => expect(field.hasAttribute('aria-invalid')).toBe(false));
    await user.keyboard('{Enter}');
    expect(onShow).toHaveBeenCalledWith(
      expect.objectContaining({ref: '창세기 1:1'}),
    );
  });

  it('keeps focus on a suggestion click and closes on outside press or resize', async () => {
    const {field, user} = setup(1);
    await user.click(field);
    await user.click(screen.getByRole('option'));
    expect(document.activeElement).toBe(field);
    expect(field.value).toBe('창세기 1:1');
    await user.click(field);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('listbox')).toBeNull();
    await user.click(field);
    await user.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('leaves IME Enter untouched and exposes invalid input only through its field reason', async () => {
    const {field, onShow, onPreview, user} = setup();
    await user.type(field, '요 3:16');
    await waitFor(() => expect(onPreview).toHaveBeenCalled());
    fireEvent.keyDown(field, {key: 'Enter', code: 'Enter', isComposing: true});
    expect(onShow).not.toHaveBeenCalled();
    await user.clear(field);
    await user.type(field, 'unknown');
    await waitFor(() =>
      expect(field.getAttribute('aria-invalid')).toBe('true'),
    );
    await user.keyboard('{Enter}');
    expect(onShow).not.toHaveBeenCalled();
    expect(field.getAttribute('aria-describedby')).not.toBeNull();
    await user.keyboard('{Escape}');
    expect(field.value).toBe('unknown');
    await user.keyboard('{Escape}');
    expect(field.value).toBe('');
  });

  it('keeps a pointed recent when book suggestions arrive later', async () => {
    const view = setup(1);
    let finish: (value: BibleLookupReply) => void = () => undefined;
    view.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    await view.user.type(view.field, '요');
    await view.user.keyboard('{ArrowDown}');
    await act(async () => finish(lookupReply(lookupRequest('요'))));
    await view.user.keyboard('{Enter}');
    expect(view.field.value).toBe('창세기 1:1');
    expect(view.onShow).not.toHaveBeenCalled();
  });

  it('disables unavailable translation input and discards its outstanding result', async () => {
    const view = setup();
    let finish: (value: BibleLookupReply) => void = () => undefined;
    view.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    fireEvent.change(view.field, {target: {value: '요 3:16'}});
    view.rerender(
      <BibleReferenceField
        api={view.api}
        translation={undefined}
        recents={[]}
        onPreview={view.onPreview}
        onShow={view.onShow}
      />,
    );
    await act(async () => finish(lookupReply(lookupRequest())));
    expect(view.field.disabled).toBe(true);
    expect(view.onPreview).not.toHaveBeenCalled();
  });

  it('ignores a response after unmount and shows a tooltip reason when transport fails', async () => {
    const view = setup();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    view.lookup.mockRejectedValueOnce(new Error('Invented transport failure'));
    fireEvent.change(view.field, {target: {value: '요 3:16'}});
    await waitFor(() =>
      expect(view.field.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(error).toHaveBeenCalled();
    let finish: (value: BibleLookupReply) => void = () => undefined;
    view.lookup.mockReturnValueOnce(
      new Promise(resolve => {
        finish = resolve;
      }),
    );
    fireEvent.change(view.field, {target: {value: '요 3:17'}});
    view.unmount();
    await act(async () => finish(lookupReply(lookupRequest('요 3:17'))));
    expect(view.onPreview).not.toHaveBeenCalled();
  });
});
