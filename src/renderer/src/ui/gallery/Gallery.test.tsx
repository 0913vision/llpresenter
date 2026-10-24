import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeAll, describe, expect, it} from 'vitest';
import {layerContainer} from '../layers';
import {Gallery, galleryEntries, galleryFilter} from './Gallery';

describe('Gallery', () => {
  it('draws a section for every component', () => {
    render(<Gallery only={undefined} />);
    for (const {name} of galleryEntries) {
      expect(screen.getByRole('heading', {level: 2, name})).toBeDefined();
    }
  });

  it('draws only the component that the query names', () => {
    render(<Gallery only="Switch" />);
    expect(screen.getAllByRole('heading', {level: 2})).toHaveLength(1);
    expect(
      screen.getByRole('heading', {level: 2, name: 'Switch'}),
    ).toBeDefined();
  });
});

describe('Gallery menu buttons', () => {
  beforeAll(() => {
    Element.prototype.scrollIntoView = () => undefined;
  });

  it('opens the 파일 menu and the service picker with ↓', async () => {
    render(<Gallery only="Overlays" />);
    for (const [button, menu] of [
      ['파일', '파일'],
      ['주일 예배', '예배 순서'],
    ] as const) {
      screen.getByRole('button', {name: button}).focus();
      await userEvent.keyboard('{ArrowDown}');
      expect(screen.getByRole('menu', {name: menu})).toBeDefined();
      await userEvent.keyboard('{Escape}');
    }
  });
});

describe('Gallery notification stack', () => {
  function stackTitles(): readonly string[] {
    const cards = layerContainer('notification').querySelectorAll('section');
    return [...cards].map(
      card => card.querySelector('[id]')?.textContent ?? '',
    );
  }

  it('replaces a card by its cause and closes the oldest information card at the fourth', async () => {
    render(<Gallery only="Notification" />);
    await userEvent.click(screen.getByRole('button', {name: '알림 쌓기'}));
    expect(stackTitles()).toEqual([
      '본 화면 모니터 다시 연결됨',
      '무대 모니터 연결 끊김',
    ]);
    const next = screen.getByRole('button', {name: '다음 알림'});
    await userEvent.click(next);
    expect(stackTitles()).toEqual([
      '무대 모니터 다시 연결됨',
      '본 화면 모니터 다시 연결됨',
    ]);
    for (let step = 0; step < 3; step++) await userEvent.click(next);
    expect(stackTitles()).toEqual([
      '저장할 수 없음',
      '본 화면 모니터 연결 끊김',
      '파일을 읽을 수 없음',
    ]);
    expect(next.getAttribute('aria-disabled')).toBe('true');
    await userEvent.click(screen.getByRole('button', {name: '모두 닫기'}));
    expect(stackTitles()).toEqual([]);
  });
});

describe('galleryFilter', () => {
  it('reads the component name from the query', () => {
    expect(galleryFilter('?c=Button')).toBe('Button');
    expect(galleryFilter('')).toBeUndefined();
  });
});
