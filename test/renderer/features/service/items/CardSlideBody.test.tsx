import {fireEvent, render, screen} from '@testing-library/react';
import {expect, it, vi} from 'vitest';
import {sectionCardOf} from '@core/services/sectionCards';
import {SUNDAY_SECTIONS} from '@core/themes/sundaySections';
import {CardSlideBody} from '@renderer/features/service/items/CardSlideBody';

vi.mock('@renderer/platform/useSlideTheme', () => ({
  useSlideTheme: () => ({}),
}));
vi.mock('@renderer/rendering/SlidePicture', () => ({
  SlidePicture: ({slide}: {slide: {label: string; lines: string[]}}) => (
    <div data-testid="card-picture">
      {slide.label}|{slide.lines.join('')}
    </div>
  ),
}));

it.each(['list', 'grid'] as const)('edits both card names in %s view', mode => {
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  const change = vi.fn();
  const select = vi.fn();
  render(
    <CardSlideBody
      itemId="item"
      card={sectionCardOf(section)}
      disabled={false}
      onChange={change}
      onSelect={select}
      mode={mode}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: section.name}));
  expect(select).toHaveBeenCalledOnce();
  const name = screen.getByRole('textbox', {name: '구역 이름'});
  fireEvent.change(name, {target: {value: '변경'}});
  expect(screen.getByTestId('card-picture').textContent).toContain('변경');
  expect(change).not.toHaveBeenCalled();
  fireEvent.blur(name);
  expect(change).toHaveBeenCalledWith('name', '변경');
  const english = screen.getByRole('textbox', {name: '영문 이름'});
  fireEvent.change(english, {target: {value: 'Changed'}});
  fireEvent.blur(english);
  expect(change).toHaveBeenCalledWith('english', 'Changed');
});

it('commits on Enter and reverts on Escape without remounting the input', () => {
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  const change = vi.fn();
  render(
    <CardSlideBody
      itemId="item"
      card={sectionCardOf(section)}
      disabled={false}
      onChange={change}
    />,
  );
  const field = screen.getByRole('textbox', {name: '구역 이름'});
  field.focus();
  fireEvent.change(field, {target: {value: 'Edited'}});
  fireEvent.keyDown(field, {key: 'Enter'});
  expect(change).toHaveBeenCalledWith('name', 'Edited');
  field.focus();
  fireEvent.change(field, {target: {value: 'Cancelled'}});
  fireEvent.keyDown(field, {key: 'Escape'});
  expect(field).toHaveProperty('value', section.name);
  expect(change).toHaveBeenCalledTimes(1);
});

it('disables both card fields for a read-only item', () => {
  const section = SUNDAY_SECTIONS[1];
  if (section === undefined) throw Error('missing section');
  render(
    <CardSlideBody
      itemId="item"
      card={sectionCardOf(section)}
      disabled
      onChange={vi.fn()}
      mode="grid"
    />,
  );
  expect(screen.getByRole('textbox', {name: '구역 이름'})).toHaveProperty(
    'disabled',
    true,
  );
  expect(screen.getByRole('textbox', {name: '영문 이름'})).toHaveProperty(
    'disabled',
    true,
  );
});
