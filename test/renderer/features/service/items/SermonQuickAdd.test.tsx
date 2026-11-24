import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {SermonQuickAdd} from '@renderer/features/service/items/SermonQuickAdd';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import type {BibleLookupReply} from '@core/schema/bibleLookup';

vi.mock('@renderer/features/service/items/useBibleDefaults', async () => {
  const {lookupRequest} = await import('@fixtures/core/bibleLookups');
  return {useBibleDefaults: () => ({translation: lookupRequest().translation})};
});

it('closes from the populated title with Escape and preserves IME composition', () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const close = vi.fn();
  render(<SermonQuickAdd onClose={close} onInsert={vi.fn()} />);
  const title = screen.getByRole('textbox', {name: '설교 제목'});
  fireEvent.change(title, {target: {value: 'Title'}});
  fireEvent.keyDown(title, {key: 'Escape', isComposing: true, keyCode: 229});
  expect(close).not.toHaveBeenCalled();
  fireEvent.keyDown(title, {key: 'Escape'});
  expect(close).toHaveBeenCalledOnce();
});

it('keeps the title on one line and moves on to the book with Enter', () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const close = vi.fn();
  const insert = vi.fn();
  render(<SermonQuickAdd onClose={close} onInsert={insert} />);
  const title = screen.getByRole('textbox', {name: '설교 제목'});
  expect(title.tagName).toBe('INPUT');
  fireEvent.change(title, {target: {value: 'Title'}});
  fireEvent.keyDown(title, {key: 'Enter', isComposing: true, keyCode: 229});
  expect(document.activeElement).toBe(title);
  fireEvent.keyDown(title, {key: 'Enter'});
  expect(document.activeElement).toBe(
    screen.getByRole('combobox', {name: '책'}),
  );
  expect(close).not.toHaveBeenCalled();
  expect(insert).not.toHaveBeenCalled();
});

it('ignores a delayed chapter lookup after Escape closes the sermon dialog', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const insert = vi.fn();
  const close = vi.fn();
  const chapterRef = '요한복음 3';
  let finish: ((reply: BibleLookupReply) => void) | undefined;
  fixture.lookup.mockImplementation(request =>
    request.input === chapterRef
      ? new Promise(resolve => {
          finish = resolve;
        })
      : formLookupReply(request),
  );
  render(<SermonQuickAdd onClose={close} onInsert={insert} />);
  fireEvent.change(screen.getByRole('textbox', {name: '설교 제목'}), {
    target: {value: 'Title'},
  });
  fireEvent.change(screen.getByRole('combobox', {name: '책'}), {
    target: {value: '요한복음'},
  });
  const chapter = screen.getByRole('textbox', {name: '장'});
  fireEvent.change(chapter, {target: {value: '3'}});
  fireEvent.keyDown(chapter, {key: 'Enter'});
  await waitFor(() => expect(finish).toBeDefined());
  fireEvent.keyDown(chapter, {key: 'Escape'});
  expect(close).toHaveBeenCalledOnce();
  await act(async () =>
    finish?.(await formLookupReply(lookupRequest(chapterRef))),
  );
  expect(insert).not.toHaveBeenCalled();
});

it('does not insert a pending recent after the title is cleared', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const translation = lookupRequest().translation;
  const document = fixture.document();
  fixture.push({
    ...document,
    revision: 2,
    value: {...document.value, recents: [{translation, ref: '요한복음 3:16'}]},
  });
  const onInsert = vi.fn();
  render(<SermonQuickAdd onClose={vi.fn()} onInsert={onInsert} />);
  const title = screen.getByRole('textbox', {name: '설교 제목'});
  fireEvent.change(title, {target: {value: 'Title'}});
  const recent = await screen.findByRole('button', {name: /요한복음 3:16/});
  await waitFor(() => expect(fixture.lookup).toHaveBeenCalled());
  let finish: (reply: BibleLookupReply) => void = () => {};
  fixture.lookup.mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  fireEvent.click(recent);
  fireEvent.change(title, {target: {value: ''}});
  await act(async () =>
    finish(await formLookupReply(lookupRequest('요한복음 3:16'))),
  );
  expect(onInsert).not.toHaveBeenCalled();
});

it('uses the passage dialog and preserves the sermon title for a recent passage', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const translation = lookupRequest().translation;
  const document = fixture.document();
  fixture.push({
    ...document,
    revision: 2,
    value: {
      ...document.value,
      recents: [{translation, ref: '요한복음 3:16'}],
    },
  });
  const onInsert = vi.fn();
  render(<SermonQuickAdd onClose={vi.fn()} onInsert={onInsert} />);
  expect(screen.getByRole('dialog', {name: '설교'})).toBeDefined();
  const title = screen.getByRole('textbox', {name: '설교 제목'});
  const recent = await screen.findByRole('button', {
    name: /요한복음 3:16/,
  });
  fireEvent.click(recent);
  expect(onInsert).not.toHaveBeenCalled();
  fireEvent.change(title, {target: {value: '하나님의 나라'}});
  fireEvent.click(recent);
  await waitFor(() => expect(onInsert).toHaveBeenCalledOnce());
  expect(onInsert).toHaveBeenCalledWith(
    '하나님의 나라',
    expect.objectContaining({ref: '요한복음 3:16', translation}),
    expect.objectContaining({translation}),
  );
});
