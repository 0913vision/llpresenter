import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeAll, describe, expect, it, vi} from 'vitest';
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

  it('demonstrates live decimal steps and their precision in number fields', async () => {
    render(<Gallery only="TextField" />);
    const seconds = screen.getByRole('spinbutton', {name: '전환 시간'});
    const spacing = screen.getByRole('spinbutton', {name: '줄 간격'});
    const speed = screen.getByRole('spinbutton', {name: '속도'});
    expect(seconds.getAttribute('aria-valuetext')).toBe('0.2');
    expect(spacing.getAttribute('aria-valuetext')).toBe('1.40');
    expect(speed.getAttribute('aria-valuetext')).toBe('1.00×');
    seconds.focus();
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowUp}{/Shift}');
    expect(seconds.getAttribute('aria-valuetext')).toBe('1.3');
    spacing.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(spacing.getAttribute('aria-valuetext')).toBe('1.45');
  });

  it('shows a live Show slider that returns pointer focus and remains reachable by Tab', async () => {
    render(<Gallery only="Slider" />);
    const note = screen.getByRole('textbox', {name: '진행 메모'});
    const volume = screen.getByRole('slider', {name: '진행 음량'});
    Object.defineProperty(volume, 'setPointerCapture', {value: vi.fn()});
    await userEvent.click(note);
    await userEvent.click(volume);
    expect(document.activeElement).toBe(note);
    await userEvent.tab();
    expect(document.activeElement).toBe(volume);
    await userEvent.keyboard('{ArrowRight}');
    expect(volume.getAttribute('aria-valuetext')).toBe('71%');
  });

  it('records shortcuts, rejects reserved keys, and cancels with native Tab', async () => {
    render(<Gallery only="KeyCap" />);
    await userEvent.click(screen.getByRole('button', {name: '단축키 바꾸기'}));
    const field = screen.getByRole('textbox', {name: '로고 화면 단축키'});
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard('{Enter}');
    expect(field.getAttribute('aria-invalid')).toBe('true');
    fireEvent.keyDown(field, {code: 'KeyC', key: 'c'});
    expect(
      document.getElementById(field.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('슬라이드 바로 가기에 쓰는 키');
    fireEvent.keyDown(field, {code: 'F2', key: 'F2'});
    expect(
      screen.getByRole('button', {name: '단축키 바꾸기'}).textContent,
    ).toBe('F2');
    await userEvent.click(screen.getByRole('button', {name: '단축키 바꾸기'}));
    await userEvent.tab();
    expect(document.activeElement).toBe(
      screen.getByRole('button', {name: '다음 명령'}),
    );
    expect(screen.queryByRole('textbox')).toBeNull();
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
