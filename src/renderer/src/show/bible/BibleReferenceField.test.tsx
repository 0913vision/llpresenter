import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import type {BibleLookupReply} from '@core/schema/bibleLookup';
import {BibleReferenceField} from './BibleReferenceField';
import {formLookupReply} from './testing/referenceForm';
import {lookupRequest} from './testBible';

beforeEach(() => {
  HTMLElement.prototype.scrollIntoView = vi.fn();
});

function setup(
  refs: readonly string[] = ['요한복음 3:16'],
  recentTranslation = lookupRequest().translation,
) {
  const lookup = vi.fn(formLookupReply);
  const onPreview = vi.fn();
  const onShow = vi.fn();
  const props = {
    api: {lookup},
    translation: lookupRequest().translation,
    recents: refs.map(ref => ({ref, translation: recentTranslation})),
    onPreview,
    onShow,
  };
  const view = render(<BibleReferenceField {...props} />);
  return {
    ...view,
    props,
    lookup,
    onPreview,
    onShow,
    user: userEvent.setup(),
    field: screen.getByRole<HTMLInputElement>('combobox', {name: '책'}),
  };
}

describe('Show Bible reference mount', () => {
  it('clears a blocked manual-field error when choosing a valid recent passage', async () => {
    const view = setup();
    await view.user.type(view.field, 'unknown');
    await view.user.tab();
    expect(document.activeElement).toBe(view.field);
    expect(view.field.getAttribute('aria-invalid')).toBe('true');
    await view.user.click(screen.getByRole('option', {name: '요한복음 3:16'}));
    await waitFor(() => expect(view.onPreview).toHaveBeenCalled());
    expect(view.field.hasAttribute('aria-invalid')).toBe(false);
    expect(view.onShow).not.toHaveBeenCalled();
    await view.user.keyboard('{Enter}');
    expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ref: '요한복음 3:16'}),
    );
  });

  it.each(['요한복음 3:16', '요한복음 3', '요한복음 3:35-4:2'])(
    'previews a recent %s in its original range before Enter outputs it',
    async ref => {
      const view = setup([ref]);
      await view.user.click(view.field);
      expect(screen.getByRole('option').getAttribute('aria-selected')).toBe(
        'false',
      );
      await view.user.keyboard('{ArrowDown}{Enter}');
      expect(view.onShow).not.toHaveBeenCalled();
      await waitFor(() =>
        expect(view.onPreview).toHaveBeenCalledWith(
          expect.objectContaining({ref}),
        ),
      );
      expect(view.field.value).toBe('');
      await view.user.keyboard('{Enter}');
      expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
        expect.objectContaining({ref}),
      );
    },
  );

  it('caps recents at ten, keeps focus on click, and closes on resize and outside press', async () => {
    const view = setup(
      Array.from({length: 15}, (_, index) => `요한복음 3:${index + 1}`),
    );
    await view.user.click(view.field);
    expect(screen.getAllByRole('option')).toHaveLength(10);
    await view.user.click(screen.getAllByRole('option')[0] ?? view.field);
    expect(document.activeElement).toBe(view.field);
    expect(screen.queryByRole('listbox')).toBeNull();
    await view.user.click(view.field);
    fireEvent(window, new Event('resize'));
    expect(screen.queryByRole('listbox')).toBeNull();
    await view.user.click(view.field);
    await view.user.click(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('uses the recent translation, then follows changed defaults without reusing old replies', async () => {
    const view = setup(
      ['요한복음 3:16'],
      lookupRequest('', 'recent').translation,
    );
    await view.user.click(view.field);
    await view.user.click(screen.getByRole('option'));
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({translation: 'recent'}),
      ),
    );
    let finish: (value: BibleLookupReply) => void = () => undefined;
    view.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
    const other = lookupRequest('요한복음 3:16', 'other');
    view.rerender(
      <BibleReferenceField {...view.props} translation={other.translation} />,
    );
    fireEvent.keyDown(view.field, {key: 'Enter'});
    expect(view.onShow).not.toHaveBeenCalled();
    await act(async () => finish(await formLookupReply(other)));
    await waitFor(() =>
      expect(view.onPreview).toHaveBeenLastCalledWith(
        expect.objectContaining({translation: other.translation}),
      ),
    );
    fireEvent.keyDown(view.field, {key: 'Enter'});
    expect(view.onShow).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({translation: other.translation}),
    );
    view.rerender(
      <BibleReferenceField {...view.props} translation={undefined} />,
    );
    expect(view.field.disabled).toBe(true);
  });
});
