import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import {fontFamilyFixture} from '@core/testing/fontCatalog';
import {FontPicker} from './FontPicker';
import {familyChoices, filterFamilies} from './fontChoices';

afterEach(() => {
  cleanup();
  document.documentElement.style.removeProperty('--size-row-menu');
});

function renderPicker(
  options: {
    readonly font?: string;
    readonly reason?: string;
  } = {},
) {
  const change = vi.fn();
  const family = fontFamilyFixture();
  const state = {status: 'ready', families: [family]} as const;
  const props = {
    id: 'font-choice',
    font: options.font ?? 'Pretendard',
    state,
    reason: options.reason,
    problem: undefined,
    onChange: change,
  };
  const view = render(
    <>
      <label htmlFor="font-choice">글꼴</label>
      <FontPicker {...props} />
    </>,
  );
  return {view, change, state, family, props};
}

it('puts bundled Pretendard first, matches localized aliases and keeps an unavailable saved family', () => {
  const family = fontFamilyFixture();
  const state = {status: 'ready', families: [family]} as const;
  const found = familyChoices('검사용 고딕', state);
  expect(found.selected).toBe(family.family);
  expect(found.options.map(item => item.value)).toEqual([
    'Pretendard',
    family.family,
  ]);
  expect(filterFamilies(found.options, 'FIXTURE')).toEqual([found.options[1]]);
  expect(filterFamilies(found.options, '검사용'.normalize('NFD'))).toEqual([
    found.options[1],
  ]);
  const missing = familyChoices('Absent Fixture', state);
  expect(missing.selected).toBe('Absent Fixture');
  expect(missing.options.at(-1)?.label).toBe('Absent Fixture');
  expect(familyChoices('Pretendard Variable', state).selected).toBe(
    'Pretendard',
  );
});

it('keeps a large list keyboard reachable while mounting only a small window', () => {
  document.documentElement.style.setProperty('--size-row-menu', '30px');
  const families = Array.from({length: 1200}, (_, index) => ({
    family: `Fixture ${index}`,
    label: `Fixture ${index}`,
    aliases: [`Alias ${index}`],
    weights: [400],
  }));
  const change = vi.fn();
  render(
    <>
      <label htmlFor="font-choice">글꼴</label>
      <FontPicker
        id="font-choice"
        font="Pretendard"
        state={{status: 'ready', families}}
        reason={undefined}
        problem={undefined}
        onChange={change}
      />
    </>,
  );
  const button = screen.getByRole('button', {name: '글꼴'});
  fireEvent.click(button);
  const search = screen.getByRole('combobox', {name: '글꼴 검색'});
  expect(document.activeElement).toBe(search);
  expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(12);
  expect(
    screen
      .getByRole('option', {name: 'Pretendard'})
      .getAttribute('aria-setsize'),
  ).toBe('1201');
  fireEvent.keyDown(search, {key: 'ArrowUp'});
  const last = screen.getByRole('option', {name: 'Fixture 1199'});
  expect(search.getAttribute('aria-activedescendant')).toBe(last.id);
  expect(last.getAttribute('aria-posinset')).toBe('1201');
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(change).toHaveBeenCalledExactlyOnceWith('Fixture 1199');
  expect(screen.queryByRole('listbox', {name: '글꼴'})).toBeNull();
  expect(document.activeElement).toBe(button);
});

it('searches aliases, retains the query when metadata arrives and commits the intended family', () => {
  const change = vi.fn();
  const props = {
    id: 'font-choice',
    font: 'Pretendard',
    reason: undefined,
    problem: undefined,
    onChange: change,
  };
  const view = render(
    <>
      <label htmlFor="font-choice">글꼴</label>
      <FontPicker {...props} state={{status: 'loading'}} />
    </>,
  );
  fireEvent.click(screen.getByRole('button', {name: '글꼴'}));
  const search = screen.getByRole('combobox', {name: '글꼴 검색'});
  fireEvent.change(search, {target: {value: '검사용'}});
  expect(screen.getByText('검색 결과 없음')).toBeDefined();
  view.rerender(
    <>
      <label htmlFor="font-choice">글꼴</label>
      <FontPicker
        {...props}
        state={{status: 'ready', families: [fontFamilyFixture()]}}
      />
    </>,
  );
  expect(search).toHaveProperty('value', '검사용');
  expect(screen.getAllByRole('option')).toHaveLength(1);
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(change).toHaveBeenCalledExactlyOnceWith('Fixture Sans');
});

it('keeps a selected family alias when the same choice is selected again', () => {
  const {change, family} = renderPicker({font: fontFamilyFixture().label});
  fireEvent.click(screen.getByRole('button', {name: '글꼴'}));
  fireEvent.click(screen.getByRole('option', {name: family.label}));
  expect(change).toHaveBeenCalledExactlyOnceWith(family.label);
});

it('does not commit an empty result, restores focus on Escape and blocks read-only edits', () => {
  const {view, change} = renderPicker();
  const button = screen.getByRole('button', {name: '글꼴'});
  fireEvent.click(button);
  const search = screen.getByRole('combobox', {name: '글꼴 검색'});
  fireEvent.change(search, {target: {value: 'no match'}});
  expect(screen.queryByRole('option')).toBeNull();
  expect(screen.getByText('검색 결과 없음')).toBeDefined();
  fireEvent.keyDown(search, {key: 'Enter'});
  expect(change).not.toHaveBeenCalled();
  fireEvent.keyDown(search, {key: 'Escape'});
  expect(document.activeElement).toBe(button);
  view.unmount();
  const readonly = renderPicker({reason: '읽기 전용'});
  const disabled = screen.getByRole('button', {name: '글꼴'});
  expect(disabled.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(disabled);
  expect(screen.queryByRole('combobox', {name: '글꼴 검색'})).toBeNull();
  expect(readonly.change).not.toHaveBeenCalled();
});

it('closes on a second trigger click and leaves focus on the trigger', async () => {
  const user = userEvent.setup();
  const {change} = renderPicker();
  const button = screen.getByRole('button', {name: '글꼴'});
  await user.click(button);
  expect(screen.getByRole('combobox', {name: '글꼴 검색'})).toBeDefined();
  await user.click(button);
  expect(screen.queryByRole('combobox', {name: '글꼴 검색'})).toBeNull();
  expect(document.activeElement).toBe(button);
  expect(change).not.toHaveBeenCalled();
});

it('does not choose or close during IME composition', () => {
  const {change} = renderPicker();
  fireEvent.click(screen.getByRole('button', {name: '글꼴'}));
  const search = screen.getByRole('combobox', {name: '글꼴 검색'});
  fireEvent.keyDown(search, {key: 'Enter', isComposing: true});
  fireEvent.keyDown(search, {key: 'Escape', isComposing: true});
  expect(screen.getByRole('combobox', {name: '글꼴 검색'})).toBe(search);
  expect(change).not.toHaveBeenCalled();
});

it('passes modified navigation and activation keys through the font search', () => {
  const {change} = renderPicker();
  fireEvent.click(screen.getByRole('button', {name: '\uAE00\uAF34'}));
  const search = screen.getByRole('combobox', {
    name: '\uAE00\uAF34 \uAC80\uC0C9',
  });
  const active = search.getAttribute('aria-activedescendant');
  for (const event of [
    {key: 'ArrowDown', ctrlKey: true},
    {key: 'ArrowUp', shiftKey: true},
    {key: 'Enter', altKey: true},
    {key: 'End', metaKey: true},
  ]) {
    expect(fireEvent.keyDown(search, event)).toBe(true);
    expect(search.getAttribute('aria-activedescendant')).toBe(active);
  }
  expect(change).not.toHaveBeenCalled();
  expect(
    screen.getByRole('combobox', {name: '\uAE00\uAF34 \uAC80\uC0C9'}),
  ).toBe(search);
});
