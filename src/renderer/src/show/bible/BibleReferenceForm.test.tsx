import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@shared/schema/bibleLookup';
import {BibleReferenceForm} from './BibleReferenceForm';
import {formLookupReply} from './testing/referenceForm';
import {lookupRequest} from './testBible';

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

function enterPassage(view: ReturnType<typeof setup>, end = ''): void {
  fireEvent.change(view.book, {target: {value: '요'}});
  fireEvent.change(view.chapter, {target: {value: '3'}});
  fireEvent.change(view.start, {target: {value: '16'}});
  if (end) fireEvent.change(view.end, {target: {value: end}});
}

describe('shared Bible reference form', () => {
  it('keeps Tab on an ambiguous arrow pick absent from the installed translation', async () => {
    const view = setup();
    view.lookup.mockImplementation(request => formLookupReply(request, [43]));
    await view.user.type(view.book, '베');
    await view.user.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(
        document.getElementById(
          view.book.getAttribute('aria-describedby') ?? '',
        )?.textContent,
      ).toBe('역본에 없는 책'),
    );
    await view.user.tab();
    expect(view.book.value).toBe('에베소서');
    expect(document.activeElement).toBe(view.book);
    expect(
      document.getElementById(view.book.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('역본에 없는 책');
    expect(view.onPreview).not.toHaveBeenCalled();
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'completes an ambiguous pick immediately while pending and returns focus only for an unavailable reply, available %s',
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
      expect(document.activeElement).toBe(available ? view.chapter : view.book);
      expect(view.book.getAttribute('aria-invalid')).toBe(
        available ? null : 'true',
      );
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
        await view.user.click(view.start);
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
          expect(view.book.getAttribute('aria-invalid')).toBe('true'),
        );
      }
      expect(document.activeElement).toBe(focus);
      if (action === 'blur') expect(document.activeElement).toBe(view.start);
      expect(view.onPreview).not.toHaveBeenCalled();
      expect(view.onSubmit).not.toHaveBeenCalled();
    },
  );

  it('keeps Tab on a canonical book absent from the selected translation', async () => {
    const view = setup();
    fireEvent.change(view.book, {target: {value: '시'}});
    await waitFor(() =>
      expect(view.book.getAttribute('aria-invalid')).toBe('true'),
    );
    expect(
      document.getElementById(view.book.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('역본에 없는 책');
    await view.user.click(view.book);
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
    expect(view.book.value).toBe('시');
    expect(view.onPreview).not.toHaveBeenCalled();
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('completes immediately while book availability is pending, then blocks Tab after an unavailable reply', async () => {
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
    expect(view.book.getAttribute('aria-invalid')).toBe('true');
    await view.user.click(view.book);
    await view.user.tab();
    expect(document.activeElement).toBe(view.book);
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
    expect(view.book.getAttribute('aria-invalid')).toBe('true');
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
    enterPassage(view);
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
    expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
    fireEvent.keyDown(view.start, {key: 'Enter', repeat: true});
    expect(view.onSubmit).toHaveBeenCalledOnce();
  });

  it.each([
    ['chapter', '22'],
    ['chapter', '0'],
    ['start', '37'],
    ['start', '1.5'],
    ['end', '15'],
    ['end', 'x'],
  ] as const)(
    'blocks invalid %s %s with only a tooltip reason',
    async (part, value) => {
      const view = setup();
      enterPassage(view);
      await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
      fireEvent.change(view[part], {target: {value}});
      await view.user.click(view[part]);
      await view.user.tab();
      expect(document.activeElement).toBe(view[part]);
      expect(view[part].getAttribute('aria-invalid')).toBe('true');
      const description = document.getElementById(
        view[part].getAttribute('aria-describedby') ?? '',
      );
      expect(description?.textContent).toContain('범위 확인');
      await view.user.keyboard('{Enter}');
      expect(view.onSubmit).not.toHaveBeenCalled();
    },
  );

  it('blocks Tab on an oversized end, clamps its lookup, and clears it when the start changes', async () => {
    const view = setup();
    enterPassage(view, '99');
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
    enterPassage(view);
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
    fireEvent.keyDown(view.start, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () =>
      finish(await formLookupReply(lookupRequest('요한복음 3:17'))),
    );
    await waitFor(() =>
      expect(view.lookup).toHaveBeenLastCalledWith(
        lookupRequest('요한복음 3:16'),
      ),
    );
    fireEvent.keyDown(view.start, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () =>
      finishReturn(await formLookupReply(lookupRequest('요한복음 3:16'))),
    );
    await waitFor(() => expect(view.onPreview).toHaveBeenCalledTimes(2));
    fireEvent.keyDown(view.start, {key: 'Enter'});
    expect(view.onSubmit).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
  });

  it('cannot use old bounds or a passage while a different translation is pending', async () => {
    const view = setup();
    enterPassage(view);
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
    fireEvent.keyDown(view.start, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
    await act(async () => finish(await formLookupReply(other)));
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({translation: other.translation}),
      ),
    );
    view.rerender(
      <BibleReferenceForm {...view.props} translation={undefined} />,
    );
    expect(view.book.disabled).toBe(true);
    expect(view.end.disabled).toBe(true);
    fireEvent.keyDown(view.start, {key: 'Enter'});
    expect(view.onSubmit).not.toHaveBeenCalled();
  });

  it('logs transport errors and ignores a reply after unmount', async () => {
    const view = setup();
    const error = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    view.lookup.mockRejectedValueOnce(new Error('Invented failure'));
    enterPassage(view);
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
