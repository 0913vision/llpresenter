import {useState, type ReactNode} from 'react';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PrepPalette} from '@renderer/features/service/items/PrepPalette';
import {ELEMENT_DRAG_MIME} from '@renderer/features/service/items/paletteItems';

function Palette({library}: {readonly library: ReactNode}) {
  const [tab, setTab] = useState<'elements' | 'songs'>('elements');
  return <PrepPalette library={library} tab={tab} onTabChange={setTab} />;
}

const insert = vi.hoisted(() => vi.fn());
vi.mock('@renderer/features/service/items/usePaletteInsert', () => ({
  usePaletteInsert: () => ({insert, disabled: false, dialog: null}),
}));
afterEach(() => {
  cleanup();
  insert.mockReset();
});
describe('preparation palette', () => {
  it('shows the cleaned groups and retains the song library tab', () => {
    render(<Palette library={<div>song library content</div>} />);
    expect(screen.getAllByRole('tab')[0]?.getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByText('순서')).toBeTruthy();
    expect(screen.getByText('구역 이름')).toBeTruthy();
    expect(screen.getAllByRole('button', {name: '사도신경'})).toHaveLength(1);
    expect(screen.getAllByRole('button', {name: '광고'})).toHaveLength(1);
    expect(screen.queryByRole('tab', {name: '미디어'})).not.toBeTruthy();
    fireEvent.click(screen.getByRole('tab', {name: '곡'}));
    expect(screen.getByText('song library content')).toBeTruthy();
  });
  it('offers new and old translations and adds with Enter or double click', () => {
    render(<Palette library={null} />);
    const creed = screen.getByRole('button', {name: '사도신경'});
    fireEvent.keyDown(creed, {key: 'Enter'});
    expect(insert).toHaveBeenCalledWith('creed');
    fireEvent.doubleClick(screen.getByRole('button', {name: '묵상기도'}));
    expect(insert).toHaveBeenCalledWith('card:묵상기도');
    fireEvent.contextMenu(creed);
    fireEvent.click(screen.getByRole('menuitem', {name: '옛 번역'}));
    expect(insert).toHaveBeenCalledWith('creed', undefined, 'old');
  });
  it('starts a native element drag', () => {
    render(<Palette library={null} />);
    const setData = vi.fn();
    const dataTransfer = {setData, effectAllowed: ''};
    fireEvent.dragStart(screen.getByRole('button', {name: '성경 구절'}), {
      dataTransfer,
    });
    expect(setData).toHaveBeenCalledWith(ELEMENT_DRAG_MIME, 'bible');
    expect(dataTransfer.effectAllowed).toBe('copy');
  });
});
