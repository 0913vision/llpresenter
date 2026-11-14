import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {
  BibleLookupPassage,
  BibleLookupReply,
} from '@core/schema/bibleLookup';
import {BibleReferenceForm} from '@renderer/features/bible/BibleReferenceForm';
import {Dialog} from '@renderer/ui/Dialog';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {BIBLE_BOOKS} from '@core/bible/bibleBooks';
import {LIVE_BIBLE_ID} from '@core/bible/liveTranslation';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function setup() {
  const lookup = vi.fn(formLookupReply);
  const onPreview = vi.fn();
  const onSubmit = vi.fn();
  const api = {lookup};
  const props = {
    api,
    translation: lookupRequest().translation,
    onPreview,
    onSubmit,
  };
  const view = render(<BibleReferenceForm {...props} />);
  return {
    ...view,
    props,
    lookup,
    onPreview,
    onSubmit,
    user: userEvent.setup(),
    book: screen.getByRole<HTMLInputElement>('combobox', {name: '책'}),
    chapter: screen.getByRole<HTMLInputElement>('textbox', {name: '장'}),
    start: screen.getByRole<HTMLInputElement>('textbox', {name: '시작절'}),
    end: screen.getByRole<HTMLInputElement>('textbox', {name: '끝절'}),
  };
}

async function enterPassage(
  view: ReturnType<typeof setup>,
  end = '',
): Promise<void> {
  fireEvent.change(view.book, {target: {value: '요'}});
  fireEvent.change(view.chapter, {target: {value: '3'}});
  await waitFor(() => expect(view.start.disabled).toBe(false));
  fireEvent.change(view.start, {target: {value: '16'}});
  if (end) fireEvent.change(view.end, {target: {value: end}});
}

describe('shared Bible reference form', () => {
  it('uses full book metadata when a live reply has no installed bounds', async () => {
    const view = setup();
    view.lookup.mockImplementation(async request => {
      const reply = await formLookupReply(
        request,
        BIBLE_BOOKS.map(book => book.id),
      );
      const {bounds: _bounds, ...withoutBounds} = reply;
      return {...withoutBounds, effectiveTranslation: LIVE_BIBLE_ID};
    });
    fireEvent.change(view.book, {target: {value: '\ud569'}});
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    fireEvent.change(view.chapter, {target: {value: '3'}});
    await waitFor(() => expect(view.start.disabled).toBe(false));
    expect(screen.getByRole('status').textContent).toBe(
      '\uac1c\uc5ed\uac1c\uc815 (\uc2e4\uc2dc\uac04)',
    );
  });
  it.each(['-', '~', '\uFF5E'])(
    'accepts a typed and pasted chapter and verse range with %s',
    async separator => {
      const view = setup();
      fireEvent.change(view.book, {target: {value: '\uc694'}});
      await waitFor(() => expect(view.chapter.disabled).toBe(false));
      await view.user.click(view.chapter);
      await view.user.type(view.chapter, '3');
      await waitFor(() => expect(view.start.disabled).toBe(false));
      await view.user.keyboard(':16');
      await waitFor(() => expect(view.end.disabled).toBe(false));
      await view.user.keyboard(`${separator}18`);
      expect([view.chapter.value, view.start.value, view.end.value]).toEqual([
        '3',
        '16',
        '18',
      ]);
      await waitFor(() =>
        expect(view.onPreview).toHaveBeenLastCalledWith(
          expect.objectContaining({ref: '\uc694\ud55c\ubcf5\uc74c 3:16-18'}),
        ),
      );
      await view.user.click(view.chapter);
      await view.user.clear(view.chapter);
      await view.user.paste(`3:16${separator}18`);
      expect([view.chapter.value, view.start.value, view.end.value]).toEqual([
        '3',
        '16',
        '18',
      ]);
      await view.user.click(view.start);
      await view.user.clear(view.start);
      await view.user.paste(`16${separator}18`);
      expect([view.start.value, view.end.value]).toEqual(['16', '18']);
    },
  );

  it.each(['Tab', 'Enter'])(
    'completes Korean, English, jamo and IME-off names with %s without marking matches red',
    async key => {
      const view = setup();
      view.lookup.mockImplementation(request =>
        formLookupReply(
          request,
          BIBLE_BOOKS.map(book => book.id),
        ),
      );
      for (const input of [
        '창세기',
        '창',
        'Genesis',
        'GEN',
        'nesis',
        '차',
        'ㅊㅏ',
        '창세',
        'ckd',
        'ckdtp',
        'ckdtprl',
      ]) {
        await view.user.click(view.book);
        fireEvent.change(view.book, {target: {value: input}});
        expect(view.book.getAttribute('aria-invalid')).toBeNull();
        await view.user.keyboard(`{${key}}`);
        expect(view.book.value).toBe('창세기');
        expect(document.activeElement).toBe(view.chapter);
        fireEvent.change(view.chapter, {target: {value: '1'}});
        await waitFor(() => expect(view.start.disabled).toBe(false));
        expect(view.book.getAttribute('aria-invalid')).toBeNull();
      }
      expect(view.onSubmit).not.toHaveBeenCalled();
    },
  );

  it('explains an unmatched IME-off name and clears the error after correction', async () => {
    const view = setup();
    await view.user.type(view.book, 'chd');
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
    expect(view.book.getAttribute('aria-invalid')).toBe('true');
    expect(
      document.getElementById(view.book.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('입력한 이름과 일치하는 성경 책이 없습니다');
    fireEvent.change(view.book, {target: {value: 'ckd'}});
    await view.user.keyboard('{Enter}');
    expect(view.book.value).toBe('창세기');
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    expect(document.activeElement).toBe(view.chapter);
  });

  it('gives an exact name priority over an arrow selection on Tab as copible does', async () => {
    const view = setup();
    await view.user.type(view.book, '요');
    await view.user.keyboard('{ArrowDown}{Tab}');
    expect(view.book.value).toBe('요한복음');
    expect(document.activeElement).toBe(view.chapter);
  });

  it.each(['Tab', 'Enter'])(
    'advances through the four fields with %s and submits only at the end',
    async key => {
      const view = setup();
      await view.user.type(view.book, 'ckd');
      await view.user.keyboard(`{${key}}`);
      expect(document.activeElement).toBe(view.chapter);
      await view.user.type(view.chapter, '1');
      await waitFor(() => expect(view.start.disabled).toBe(false));
      await view.user.keyboard(`{${key}}`);
      expect(document.activeElement).toBe(view.start);
      await view.user.type(view.start, '1');
      await view.user.keyboard(`{${key}}`);
      expect(document.activeElement).toBe(view.end);
      expect(view.onSubmit).not.toHaveBeenCalled();
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      await view.user.keyboard('{Enter}');
      expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ref: '창세기 1:1'}),
      );
    },
  );

  it('completes mrk to Mark instead of the IME-off Zechariah containment match', async () => {
    const view = setup();
    view.lookup.mockImplementation(request => formLookupReply(request, [41]));
    await view.user.type(view.book, 'mrk');
    await view.user.tab();
    expect(view.book.value).toBe('마가복음');
    expect(document.activeElement).toBe(view.chapter);
  });

  it.each(['{ArrowUp}', '{ArrowDown}{ArrowUp}'])(
    'leaves no choice after %s and blocks ambiguous Tab',
    async keys => {
      const view = setup();
      await view.user.type(view.book, '베');
      await view.user.keyboard(keys);
      expect(view.book.hasAttribute('aria-activedescendant')).toBe(false);
      expect(
        screen
          .getAllByRole('option')
          .every(row => row.getAttribute('aria-selected') === 'false'),
      ).toBe(true);
      await view.user.tab();
      expect(view.book.value).toBe('베');
      expect(document.activeElement).toBe(view.book);
      await view.user.keyboard('{ArrowDown}{Tab}');
      expect(view.book.value).toBe('에베소서');
      expect(document.activeElement).toBe(view.chapter);
    },
  );

  it('gates the numeric fields and clears descendants of invalid input', async () => {
    const view = setup();
    expect([
      view.chapter.disabled,
      view.start.disabled,
      view.end.disabled,
    ]).toEqual([true, true, true]);
    await view.user.type(view.book, '요');
    expect([
      view.chapter.disabled,
      view.start.disabled,
      view.end.disabled,
    ]).toEqual([false, true, true]);
    await view.user.type(view.chapter, '3');
    await waitFor(() => expect(view.start.disabled).toBe(false));
    expect(view.end.disabled).toBe(true);
    await view.user.type(view.start, '16');
    await view.user.type(view.end, '18');
    fireEvent.change(view.start, {target: {value: '37'}});
    expect(view.end.value).toBe('');
    expect(view.end.disabled).toBe(true);
    fireEvent.change(view.chapter, {target: {value: '22'}});
    expect(view.start.value).toBe('');
    expect(view.start.disabled).toBe(true);
    fireEvent.change(view.book, {target: {value: '베'}});
    expect(view.chapter.value).toBe('');
    expect(view.chapter.disabled).toBe(true);
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it.each(['chapter', 'start', 'end'] as const)(
    'filters non-digit typing and paste in %s without breaking edit keys',
    async part => {
      const view = setup();
      await enterPassage(view, '18');
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      const field = view[part];
      const value = field.value;
      await view.user.click(field);
      await view.user.keyboard('a.+가');
      expect(field.value).toBe(value);
      await view.user.paste('1.5');
      expect(field.value).toBe(value);
      expect(view.end.value).toBe('18');
      expect(fireEvent.keyDown(field, {key: 'a', ctrlKey: true})).toBe(true);
      expect(fireEvent.keyDown(field, {key: 'a', metaKey: true})).toBe(true);
      expect(
        fireEvent.keyDown(field, {key: 'Process', isComposing: true}),
      ).toBe(true);
      await view.user.keyboard('{Home}{Delete}');
      expect(field.value).toBe(value.slice(1));
    },
  );

  it('accepts an ambiguous book absent from the installed translation', async () => {
    const view = setup();
    view.lookup.mockImplementation(request => formLookupReply(request, [43]));
    await view.user.type(view.book, '\ubca0');
    await view.user.keyboard('{ArrowDown}{Tab}');
    expect(view.book.value).toBe('\uc5d0\ubca0\uc18c\uc11c');
    expect(document.activeElement).toBe(view.chapter);
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'completes an ambiguous pick using static metadata while the reply is pending, available %s',
    async available => {
      const view = setup();
      let finish: (reply: BibleLookupReply) => void = () => undefined;
      view.lookup.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      await view.user.type(view.book, '베');
      await view.user.keyboard('{ArrowDown}{Tab}');
      expect(view.book.value).toBe('에베소서');
      expect(document.activeElement).toBe(view.chapter);
      await view.user.tab();
      expect(document.activeElement).toBe(view.chapter);
      await act(async () =>
        finish(
          await formLookupReply(
            lookupRequest('에베소서'),
            available ? [43, 49] : [43],
          ),
        ),
      );
      expect(document.activeElement).toBe(view.chapter);
      expect(view.book.getAttribute('aria-invalid')).toBeNull();
    },
  );

  it.each(['edit', 'blur', 'translation', 'composition'] as const)(
    'cancels a late unavailable-book focus correction after %s',
    async action => {
      const view = setup();
      view.lookup.mockImplementation(request => formLookupReply(request, [43]));
      let finish: (reply: BibleLookupReply) => void = () => undefined;
      view.lookup.mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      );
      await view.user.type(view.book, '베');
      await view.user.keyboard('{ArrowDown}{Tab}');
      expect(document.activeElement).toBe(view.chapter);
      if (action === 'edit') {
        fireEvent.change(view.chapter, {target: {value: '2'}});
      } else if (action === 'blur') {
        await view.user.click(view.book);
      } else if (action === 'translation') {
        view.rerender(
          <BibleReferenceForm {...view.props} translation={undefined} />,
        );
      } else {
        fireEvent.compositionStart(view.chapter);
      }
      const focus = document.activeElement;
      await act(async () =>
        finish(await formLookupReply(lookupRequest('에베소서'), [43])),
      );
      if (action === 'translation') {
        view.rerender(<BibleReferenceForm {...view.props} />);
        await waitFor(() =>
          expect(view.book.getAttribute('aria-invalid')).toBeNull(),
        );
      }
      expect(document.activeElement).toBe(focus);
      if (action === 'blur') expect(document.activeElement).toBe(view.book);
      expect(view.onPreview).not.toHaveBeenCalled();
      expect(view.onSubmit).not.toHaveBeenCalled();
    },
  );

  it('accepts a canonical book absent from the installed translation', async () => {
    const view = setup();
    fireEvent.change(view.book, {target: {value: '\uc2dc'}});
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    await view.user.click(view.book);
    await view.user.tab();
    expect(document.activeElement).toBe(view.chapter);
    expect(view.book.value).toBe('\uc2dc\ud3b8');
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('completes using static metadata even if an installed translation has no book', async () => {
    const view = setup();
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    view.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.change(view.book, {target: {value: '시'}});
    await view.user.click(view.book);
    await view.user.tab();
    expect(view.book.value).toBe('시편');
    expect(document.activeElement).toBe(view.chapter);
    await act(async () => finish(await formLookupReply(lookupRequest('시편'))));
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    await view.user.click(view.book);
    await view.user.tab();
    expect(document.activeElement).toBe(view.chapter);
    expect(view.onPreview).not.toHaveBeenCalled();
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('focuses the book after delayed translation availability when autofocus is requested', async () => {
    const view = setup();
    view.rerender(
      <BibleReferenceForm {...view.props} autoFocus translation={undefined} />,
    );
    expect(view.book.disabled).toBe(true);
    view.rerender(<BibleReferenceForm {...view.props} autoFocus />);
    await waitFor(() => expect(document.activeElement).toBe(view.book));
  });

  it('requires an arrow choice for ambiguous Tab even after pointer hover', async () => {
    const view = setup();
    await view.user.type(view.book, '베');
    fireEvent.mouseMove(screen.getAllByRole('option')[0] ?? view.book);
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
    expect(view.book.value).toBe('베');
    await view.user.keyboard('{ArrowDown}{Tab}');
    expect(view.book.value).toBe('베드로전서');
    expect(document.activeElement).toBe(view.chapter);
  });

  it('lets Tab leave an empty 책 field, and keeps completing a partial book', async () => {
    const view = setup();
    view.book.focus();

    await view.user.tab();

    expect(document.activeElement).not.toBe(view.book);
    expect(view.chapter.disabled).toBe(true);
    expect(view.book.value).toBe('');
    expect(view.book.getAttribute('aria-invalid')).not.toBe('true');

    await view.user.tab({shift: true});
    await view.user.type(view.book, '베');
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
  });

  it('lets Tab cross an untouched form and Shift Tab return without requiring a passage', async () => {
    const view = setup();
    render(<button type="button">다음 패널</button>);
    view.book.focus();

    for (const field of [view.chapter, view.start, view.end]) {
      expect(field.disabled).toBe(true);
    }
    await view.user.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '다음 패널'}),
    );
    await view.user.tab({shift: true});
    expect(document.activeElement).toBe(view.book);
    expect(view.book.getAttribute('aria-invalid')).not.toBe('true');
    expect(view.onSubmit).not.toHaveBeenCalled();
    expect(view.onPreview).not.toHaveBeenCalled();
  });

  it('lets Tab leave an empty 책 field after an arrow key that points at nothing', async () => {
    const view = setup();
    view.book.focus();

    await view.user.keyboard('{ArrowDown}{Tab}');

    expect(view.book.value).toBe('');
    expect(document.activeElement).not.toBe(view.book);
    expect(view.chapter.disabled).toBe(true);
  });

  it('starts without a highlight and blocks ambiguous Tab until an arrow selects a book', async () => {
    const view = setup();
    await view.user.type(view.book, '베');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    expect(
      screen
        .getAllByRole('option')
        .every(row => row.getAttribute('aria-selected') === 'false'),
    ).toBe(true);
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
    expect(view.book.value).toBe('베');
    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    await view.user.keyboard('{ArrowDown}{ArrowDown}{Tab}');
    expect(view.book.value).toBe('베드로전서');
    expect(document.activeElement).toBe(view.chapter);
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it.each(['창', 'ckdtp', 'Genesis', '요'])(
    'completes exact or unique input %s synchronously and advances Tab',
    async input => {
      const view = setup();
      view.lookup.mockImplementation(() => new Promise(() => undefined));
      await view.user.type(view.book, input);
      await view.user.tab();
      expect(view.book.value).toBe(input === '요' ? '요한복음' : '창세기');
      expect(document.activeElement).toBe(view.chapter);
    },
  );

  it('keeps all matches beyond eight and lets a click complete a book and move to 장 without output', async () => {
    const view = setup();
    await view.user.type(view.book, '서');
    expect(screen.getByRole('listbox').hasAttribute('data-over-modal')).toBe(
      false,
    );
    expect(screen.getAllByRole('option').length).toBeGreaterThan(8);
    await view.user.click(screen.getByRole('option', {name: '요한일서'}));
    expect(view.book.value).toBe('요한일서');
    expect(document.activeElement).toBe(view.chapter);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('moves through valid fields, leaves Shift Tab and IME keys alone, and previews before output', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    await view.user.click(view.chapter);
    await view.user.tab();
    expect(document.activeElement).toBe(view.start);
    await view.user.tab();
    expect(document.activeElement).toBe(view.end);
    await view.user.tab({shift: true});
    expect(document.activeElement).toBe(view.start);
    expect(fireEvent.keyDown(view.start, {key: 'Tab', isComposing: true})).toBe(
      true,
    );
    fireEvent.keyDown(view.start, {key: 'Enter', isComposing: true});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await view.user.keyboard('{Enter}');
    expect(document.activeElement).toBe(view.end);
    expect(view.onSubmit).not.toHaveBeenCalled();
    await view.user.keyboard('{Enter}');
    expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
    fireEvent.keyDown(view.end, {key: 'Enter', repeat: true});
    expect(view.onSubmit).toHaveBeenCalledOnce();
  });

  it.each([
    ['chapter', '22'],
    ['chapter', '0'],
    ['start', '37'],
    ['end', '15'],
  ] as const)(
    'blocks invalid %s %s with only a tooltip reason',
    async (part, value) => {
      const view = setup();
      await enterPassage(view);
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      fireEvent.change(view[part], {target: {value}});
      await view.user.click(view[part]);
      await view.user.tab();
      expect(document.activeElement).toBe(view[part]);
      expect(view[part].getAttribute('aria-invalid')).toBe('true');
      const description = document.getElementById(
        view[part].getAttribute('aria-describedby') ?? '',
      );
      expect(description?.textContent).toContain('확인해야 합니다');
      await view.user.keyboard('{Enter}');
      expect(view.onSubmit).not.toHaveBeenCalled();
    },
  );

  it('lets Shift Tab leave a blocked field and Esc return to 책 without the reason', async () => {
    const view = setup();
    await view.user.type(view.book, '요');
    await view.user.click(view.chapter);
    await view.user.tab();
    expect(document.activeElement).toBe(view.chapter);
    expect(view.chapter.getAttribute('aria-invalid')).toBe('true');
    await view.user.tab({shift: true});
    expect(document.activeElement).toBe(view.book);
    fireEvent.change(view.chapter, {target: {value: '3'}});
    await waitFor(() => expect(view.start.disabled).toBe(false));
    await view.user.click(view.start);
    await view.user.tab();
    expect(document.activeElement).toBe(view.start);
    expect(view.start.getAttribute('aria-invalid')).toBe('true');
    await view.user.keyboard('{Escape}');
    expect(document.activeElement).toBe(view.book);
    expect(view.start.getAttribute('aria-invalid')).toBeNull();
  });

  it('blocks Tab on an oversized end, clamps its lookup, and clears it when the start changes', async () => {
    const view = setup();
    await enterPassage(view, '99');
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({ref: '요한복음 3:16-36'}),
      ),
    );
    await view.user.click(view.end);
    await view.user.tab();
    expect(document.activeElement).toBe(view.end);
    await view.user.keyboard('{Enter}');
    expect(view.end.value).toBe('36');
    expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16-36'}),
    );
    fireEvent.change(view.start, {target: {value: '17'}});
    expect(view.end.value).toBe('');
  });

  it('does not submit an old passage when returning to it during a new lookup', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    let finishReturn: (reply: BibleLookupReply) => void = () => undefined;
    view.lookup
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise(resolve => {
            finishReturn = resolve;
          }),
      );
    fireEvent.change(view.start, {target: {value: '17'}});
    await waitFor(() =>
      expect(view.lookup).toHaveBeenLastCalledWith(
        lookupRequest('요한복음 3:17'),
      ),
    );
    fireEvent.change(view.start, {target: {value: '16'}});
    fireEvent.keyDown(view.end, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음 3:17'))),
    );
    await waitFor(() =>
      expect(view.lookup).toHaveBeenLastCalledWith(
        lookupRequest('요한복음 3:16'),
      ),
    );
    fireEvent.keyDown(view.end, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () =>
      finishReturn(await formLookupReply(lookupRequest('요한복음 3:16'))),
    );
    await waitFor(() => expect(view.onPreview).toHaveBeenCalledTimes(2));
    expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
  });

  it('submits the final field when Enter immediately follows typing', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.end.disabled).toBe(false));
    act(() => {
      fireEvent.change(view.end, {target: {value: '18'}});
      fireEvent.keyDown(view.end, {key: 'Enter'});
    });
    await waitFor(() =>
      expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ref: '요한복음 3:16-18'}),
      ),
    );
  });

  it('shows an invalid end on immediate Enter without submitting', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.end.disabled).toBe(false));
    act(() => {
      fireEvent.change(view.end, {target: {value: '15'}});
      fireEvent.keyDown(view.end, {key: 'Enter'});
    });
    expect(view.end.getAttribute('aria-invalid')).toBe('true');
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('cancels a pending Enter when the reference is edited', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    view.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.change(view.end, {target: {value: '18'}});
    fireEvent.keyDown(view.end, {key: 'Enter'});
    await waitFor(() =>
      expect(view.lookup).toHaveBeenLastCalledWith(
        lookupRequest('요한복음 3:16-18'),
      ),
    );
    fireEvent.change(view.end, {target: {value: '19'}});
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음 3:16-18'))),
    );
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({ref: '요한복음 3:16-19'}),
      ),
    );
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('keeps static bounds but does not use an old passage while a different translation is pending', async () => {
    const view = setup();
    await enterPassage(view);
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    view.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const other = lookupRequest('요한복음', 'other');
    view.rerender(
      <BibleReferenceForm {...view.props} translation={other.translation} />,
    );
    expect(view.start.value).toBe('16');
    expect(view.start.disabled).toBe(false);
    expect(view.end.disabled).toBe(false);
    fireEvent.keyDown(view.end, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () => finish(await formLookupReply(other)));
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({translation: other.translation}),
      ),
    );
    expect(view.start.disabled).toBe(false);
    expect(view.end.disabled).toBe(false);
    await waitFor(() =>
      expect(view.onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({translation: other.translation}),
      ),
    );
    view.onSubmit.mockClear();
    view.rerender(
      <BibleReferenceForm {...view.props} translation={undefined} />,
    );
    expect(view.book.disabled).toBe(true);
    expect(view.end.disabled).toBe(true);
    fireEvent.keyDown(view.end, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('logs transport errors and ignores a reply after unmount', async () => {
    const view = setup();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    view.lookup.mockRejectedValueOnce(new Error('Invented failure'));
    fireEvent.change(view.book, {target: {value: '요'}});
    await waitFor(() => expect(error).toHaveBeenCalled());
    let finish: (reply: BibleLookupReply) => void = () => undefined;
    view.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    fireEvent.change(view.book, {target: {value: '창'}});
    view.unmount();
    await act(async () =>
      finish(await formLookupReply(lookupRequest('창세기'))),
    );
    expect(view.onPreview).not.toHaveBeenCalled();
  });
});

describe('Bible reference form readiness', () => {
  function ready(view: ReturnType<typeof setup>) {
    const onReady = vi.fn<(passage: BibleLookupPassage | null) => void>();
    view.rerender(<BibleReferenceForm {...view.props} onReady={onReady} />);
    return onReady;
  }

  it('clears the ready passage when a new book replaces a valid one', async () => {
    const view = setup();
    const onReady = ready(view);
    view.lookup.mockImplementation(request => formLookupReply(request, [43]));
    await enterPassage(view);
    await waitFor(() => expect(onReady.mock.lastCall?.[0]).toBeTruthy());

    await view.user.clear(view.book);
    await view.user.type(view.book, '베');
    await view.user.keyboard('{ArrowDown}{Tab}');

    expect(view.book.getAttribute('aria-invalid')).toBeNull();
    expect(view.book.value).toBe('에베소서');
    await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(null));
  });

  it.each([
    ['장', '22'],
    ['시작절', '37'],
    ['끝절', '15'],
  ] as const)(
    'reports no ready passage for an invalid %s',
    async (label, value) => {
      const view = setup();
      const onReady = ready(view);
      await enterPassage(view);
      await waitFor(() => expect(onReady.mock.lastCall?.[0]).toBeTruthy());

      fireEvent.change(screen.getByRole('textbox', {name: label}), {
        target: {value},
      });

      await waitFor(() => expect(onReady).toHaveBeenLastCalledWith(null));
    },
  );
});

describe('Bible reference suggestions in a dialog', () => {
  it('lifts its suggestions over the dialog and takes a pointer choice', async () => {
    const user = userEvent.setup();
    render(
      <Dialog
        title="성경 구절"
        size="s"
        onCancel={vi.fn()}
        primary={{label: '추가', onSelect: vi.fn()}}
      >
        <BibleReferenceForm
          api={{lookup: vi.fn(formLookupReply)}}
          translation={lookupRequest().translation}
          onPreview={vi.fn()}
          onSubmit={vi.fn()}
        />
      </Dialog>,
    );
    const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});

    await user.type(book, '요');
    const list = screen.getByRole('listbox', {name: '성경 구절 추천'});
    expect(list.hasAttribute('data-over-modal')).toBe(true);
    expect(list.closest('[inert]')).toBeNull();
    await user.click(within(list).getByRole('option', {name: '요한복음'}));

    expect(book.value).toBe('요한복음');
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
