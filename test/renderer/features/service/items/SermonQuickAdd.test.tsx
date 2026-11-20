import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {expect, it, onTestFinished, vi} from 'vitest';
import {SermonQuickAdd} from '@renderer/features/service/items/SermonQuickAdd';
import {panelApi} from '@fixtures/contracts/ipc/bibleApi';
import {lookupRequest} from '@fixtures/core/bibleLookups';
import {createServiceItemId} from '@core/schema/ids';
import {formLookupReply} from '@fixtures/core/bibleReplies';
import type {BibleLookupReply} from '@core/schema/bibleLookup';

vi.mock('@renderer/features/service/items/useBibleDefaults', async () => {
  const {lookupRequest} = await import('@fixtures/core/bibleLookups');
  return {useBibleDefaults: () => ({translation: lookupRequest().translation})};
});

it('keeps the existing passage when only the sermon title changes', async () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const translation = lookupRequest().translation;
  const ref = '요한복음 3:16-18';
  const onInsert = vi.fn();
  render(
    <SermonQuickAdd
      onClose={vi.fn()}
      onInsert={onInsert}
      initial={{
        id: createServiceItemId('00000000-0000-4000-8000-000000000123'),
        sermon: {
          title: 'Old title',
          passage: {
            translation,
            ref,
            split: '',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
      }}
    />,
  );
  fireEvent.change(screen.getByRole('textbox', {name: '제목'}), {
    target: {value: 'New title'},
  });
  const end = screen.getByRole('textbox', {name: '끝절'});
  await waitFor(() => expect(fixture.lookup).toHaveBeenCalled());
  fireEvent.keyDown(end, {key: 'Enter'});
  await waitFor(() => expect(onInsert).toHaveBeenCalledOnce());
  expect(onInsert).toHaveBeenCalledWith(
    'New title',
    ref,
    expect.objectContaining({translation}),
  );
});

it('clears the existing reference on Escape and closes on the next Escape', () => {
  const fixture = panelApi();
  window.llp = fixture.api;
  onTestFinished(() => {
    delete window.llp;
  });
  const onClose = vi.fn();
  render(
    <SermonQuickAdd
      onClose={onClose}
      onInsert={vi.fn()}
      initial={{
        id: createServiceItemId('00000000-0000-4000-8000-000000000123'),
        sermon: {
          title: 'Title',
          passage: {
            translation: lookupRequest().translation,
            ref: '요한복음 3:16-18',
            split: '',
            reference: 'every',
            verseNumbers: true,
            translationName: false,
          },
        },
      }}
    />,
  );
  const book = screen.getByRole<HTMLInputElement>('combobox', {name: '책'});
  fireEvent.keyDown(book, {key: 'Escape'});
  expect(
    screen.getByRole<HTMLInputElement>('combobox', {name: '책'}).value,
  ).toBe('');
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole('combobox', {name: '책'}), {
    key: 'Escape',
  });
  expect(onClose).toHaveBeenCalledOnce();
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
  const title = screen.getByRole('textbox', {name: '제목'});
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
  expect(screen.getByRole('dialog', {name: '성경 구절'})).toBeDefined();
  const title = screen.getByRole('textbox', {name: '제목'});
  const recent = await screen.findByRole('button', {
    name: /요한복음 3:16/,
  });
  fireEvent.click(recent);
  expect(onInsert).not.toHaveBeenCalled();
  fireEvent.change(title, {target: {value: 'First line\nSecond line'}});
  fireEvent.click(recent);
  await waitFor(() => expect(onInsert).toHaveBeenCalledOnce());
  expect(onInsert).toHaveBeenCalledWith(
    'First line\nSecond line',
    '요한복음 3:16',
    expect.objectContaining({translation}),
  );
});
