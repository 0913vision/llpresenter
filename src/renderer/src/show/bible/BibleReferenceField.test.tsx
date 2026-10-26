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
  it('completes a single exact book before a pending lookup answers', () => {
    const view = setup();
    view.lookup.mockImplementation(() => new Promise(() => undefined));
    fireEvent.change(view.field, {target: {value: '창'}});
    expect(fireEvent.keyDown(view.field, {key: 'Tab', cancelable: true})).toBe(
      false,
    );
    expect(view.field.value).toBe('창세기 ');
    expect(view.field.selectionStart).toBe(4);
    expect(view.onShow).not.toHaveBeenCalled();
  });
  it('takes the highlighted book and keeps an existing range after the book caret', async () => {
    const view = setup();
    fireEvent.change(view.field, {target: {value: '요한'}});
    view.field.focus();
    expect(
      screen.getAllByRole('option')[0]?.getAttribute('aria-selected'),
    ).toBe('true');
    await view.user.keyboard('{ArrowDown}{Tab}');
    expect(view.field.value).toBe('요한일서 ');
    fireEvent.change(view.field, {target: {value: '창 1:1-5'}});
    view.field.setSelectionRange(1, 1);
    fireEvent.keyDown(view.field, {key: 'Tab'});
    expect(view.field.value).toBe('창세기 1:1-5');
    expect(view.field.selectionStart).toBe(4);
    expect(view.field.selectionEnd).toBe(4);
    expect(view.onShow).not.toHaveBeenCalled();
  });
  it('leaves Shift Tab, IME Tab and chapter-position Tab to normal navigation', () => {
    const view = setup();
    fireEvent.change(view.field, {target: {value: '창'}});
    expect(fireEvent.keyDown(view.field, {key: 'Tab', shiftKey: true})).toBe(
      true,
    );
    expect(fireEvent.keyDown(view.field, {key: 'Tab', isComposing: true})).toBe(
      true,
    );
    expect(view.field.value).toBe('창');
    fireEvent.change(view.field, {target: {value: '창 1:1'}});
    expect(fireEvent.keyDown(view.field, {key: 'Tab'})).toBe(true);
    expect(view.field.value).toBe('창 1:1');
  });
  it.each(['chapter', 'verse'] as const)(
    'exposes a %s range error in the field and blocks output',
    async code => {
      const view = setup();
      const message =
        code === 'chapter'
          ? '장이 범위를 벗어났습니다'
          : '절이 범위를 벗어났습니다';
      view.lookup.mockImplementation(async request => ({
        ...lookupReply(request),
        result: {ok: false, error: {code, message}},
      }));
      fireEvent.change(view.field, {
        target: {value: code === 'chapter' ? '요 999:1' : '요 3:999'},
      });
      await waitFor(() =>
        expect(view.field.getAttribute('aria-invalid')).toBe('true'),
      );
      fireEvent.keyDown(view.field, {key: 'Enter'});
      await waitFor(() =>
        expect(view.field.getAttribute('aria-invalid')).toBe('true'),
      );
      expect(view.onShow).not.toHaveBeenCalled();
      expect(view.onPreview).not.toHaveBeenCalled();
      expect(view.field.getAttribute('aria-describedby')).toBe(
        screen.getByText(message).id,
      );
      await view.user.hover(view.field);
      expect((await screen.findByRole('tooltip')).textContent).toContain(
        message,
      );
    },
  );
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
  it('outputs the valid current passage even when the reply omits book suggestions', async () => {
    const view = setup();
    view.lookup.mockImplementation(async request => ({
      ...lookupReply(request),
      suggestions: [],
    }));
    fireEvent.change(view.field, {target: {value: '요 3:16'}});
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    fireEvent.keyDown(view.field, {key: 'Enter'});
    expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
    expect(view.field.value).toBe('요 3:16');
  });

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
    fireEvent.keyDown(field, {key: 'Enter', repeat: true});
    expect(onShow).toHaveBeenCalledTimes(1);
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
    expect(field.value).toBe('');
  });

  it('keeps a pointed recent when passage details arrive later', async () => {
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
