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

function setup(count = 0, recentTranslation = lookupRequest().translation) {
  const lookup = vi.fn(async (request: BibleLookupRequest) =>
    lookupReply(request),
  );
  const onPreview = vi.fn();
  const onShow = vi.fn();
  const api = {lookup};
  const recents = Array.from({length: count}, (_, index) => ({
    ref: `창세기 1:${index + 1}`,
    translation: recentTranslation,
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
  it.each(['book', 'recent'])(
    'honors translation changes and removal after choosing a %s suggestion',
    async kind => {
      const view = setup(
        kind === 'recent' ? 1 : 0,
        lookupRequest('', 'recent').translation,
      );
      if (kind === 'book') await view.user.type(view.field, '요 3:16');
      else await view.user.click(view.field);
      await view.user.click(screen.getByRole('option'));
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      const input = view.field.value;
      const other = lookupRequest(input, 'other');
      let finish: (value: BibleLookupReply) => void = () => undefined;
      view.lookup.mockReturnValueOnce(
        new Promise(resolve => {
          finish = resolve;
        }),
      );
      const rerender = (
        translation: BibleLookupRequest['translation'] | undefined,
      ): void =>
        view.rerender(
          <BibleReferenceField
            api={view.api}
            translation={translation}
            recents={[]}
            onPreview={view.onPreview}
            onShow={view.onShow}
          />,
        );
      rerender(other.translation);
      expect(view.field.value).toBe(input);
      fireEvent.keyDown(view.field, {key: 'Enter'});
      expect(view.onShow).not.toHaveBeenCalled();
      await act(async () => finish(lookupReply(other)));
      await view.user.keyboard('{Enter}');
      expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({translation: other.translation}),
      );
      rerender(undefined);
      view.onShow.mockClear();
      expect(view.field.disabled).toBe(true);
      fireEvent.keyDown(view.field, {key: 'Enter'});
      expect(view.onShow).not.toHaveBeenCalled();
      rerender(lookupRequest().translation);
      await waitFor(() =>
        expect(view.onPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({translation: lookupRequest().translation}),
        ),
      );
      await view.user.keyboard('{Enter}');
      expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({translation: lookupRequest().translation}),
      );
    },
  );

  it.each(['요 3장 16절', '요 3장 16-18절'])(
    'shows the verse count and outputs a pointed current Korean-format passage %s',
    async input => {
      const view = setup();
      await view.user.type(view.field, input);
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      const count = input.includes('-') ? 3 : 1;
      expect(screen.getByRole('option').textContent).toContain(`${count}절`);
      expect(screen.getByRole('option').textContent).toContain('요한복음 3장');
      await view.user.keyboard('{ArrowDown}{Enter}');
      expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({
          ref: count === 3 ? '요한복음 3:16-18' : '요한복음 3:16',
        }),
      );
      expect(view.field.value).toBe(input);
    },
  );
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
