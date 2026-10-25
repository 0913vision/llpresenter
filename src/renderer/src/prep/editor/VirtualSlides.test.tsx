import {useState, type JSX} from 'react';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';
import {editorSong} from './editorFixture';
import {VirtualSlides} from './VirtualSlides';

const NUMBERS = Array.from({length: 2000}, (_, index) => (index % 2) + 1);
function List(): JSX.Element {
  const [selected, setSelected] = useState(0);
  return (
    <VirtualSlides
      song={editorSong(1).song}
      numbers={NUMBERS}
      labels={[]}
      selected={selected}
      onSelect={setSelected}
      baseline={3}
      scale={100}
    />
  );
}

describe('virtual editor slides', () => {
  it('keeps a bounded window, reaches both ends, and focuses the logical selected occurrence', () => {
    render(<List />);
    expect(screen.getAllByRole('option').length).toBeLessThan(20);
    const first = screen.getAllByRole('option')[0];
    if (first === undefined) throw new Error('No first thumbnail');
    expect(first.getAttribute('aria-posinset')).toBe('1');
    expect(first.getAttribute('aria-setsize')).toBe('2000');
    expect(screen.getByRole('listbox').getAttribute('aria-orientation')).toBe(
      'vertical',
    );
    act(() => first.focus());
    fireEvent.keyDown(first, {key: 'End'});
    const last = screen.getAllByRole('option').at(-1);
    if (last === undefined) throw new Error('No last thumbnail');
    expect(document.activeElement).toBe(last);
    expect(last.getAttribute('aria-selected')).toBe('true');
    expect(last.getAttribute('aria-posinset')).toBe('2000');
    expect(screen.getAllByRole('option').length).toBeLessThan(20);
    fireEvent.keyDown(last, {key: 'Home'});
    const returned = screen.getAllByRole('option')[0];
    if (returned === undefined) throw new Error('No first thumbnail');
    expect(document.activeElement).toBe(returned);
    expect(returned.getAttribute('aria-posinset')).toBe('1');
    fireEvent.keyDown(returned, {key: 'ArrowDown'});
    expect(document.activeElement?.getAttribute('aria-posinset')).toBe('4');
  });

  it('passes modified and composing keys without changing selection', () => {
    const onSelect = vi.fn();
    render(
      <VirtualSlides
        song={editorSong(1).song}
        numbers={NUMBERS}
        labels={[]}
        selected={0}
        onSelect={onSelect}
        baseline={3}
        scale={100}
      />,
    );
    const first = screen.getAllByRole('option')[0];
    if (first === undefined) throw new Error('No first thumbnail');
    for (const modifiers of [
      {ctrlKey: true},
      {shiftKey: true},
      {altKey: true},
      {metaKey: true},
      {isComposing: true},
    ]) {
      expect(fireEvent.keyDown(first, {key: 'End', ...modifiers})).toBe(true);
    }
    expect(onSelect).not.toHaveBeenCalled();
  });
});
