import {act, fireEvent, render, screen} from '@testing-library/react';
import {expect, it} from 'vitest';
import {ControlSession} from '@renderer/app/controlSession';
import {NoticeHistoryButton} from '@renderer/app/shell/NoticeHistory';
import type {Notice} from '@renderer/ui/notices';

const lost: Notice = {
  key: 'screen:stage',
  kind: 'warning',
  icon: 'plug',
  title: '무대 모니터 연결 끊김',
  time: '19:42',
  meta: ['모니터 3', '창으로 표시 중'],
};

it('lists every notice of the window under the bell, marks new ones and clears them', () => {
  const session = new ControlSession(undefined);
  render(<NoticeHistoryButton session={session} />);
  expect(screen.getByRole('button', {name: '알림'})).toBeTruthy();
  act(() => {
    session.report(lost);
    session.dismiss(lost.key);
  });
  fireEvent.click(screen.getByRole('button', {name: '새 알림'}));
  const panel = screen.getByRole('dialog', {name: '알림'});
  expect(panel.textContent).toContain('무대 모니터 연결 끊김');
  expect(panel.textContent).toContain('모니터 3');
  expect(panel.textContent).toContain('19:42');
  expect(screen.getByRole('button', {name: '알림'})).toBeTruthy();
  fireEvent.click(screen.getByRole('button', {name: '모두 지우기'}));
  expect(panel.textContent).toContain('알림이 없습니다.');
  fireEvent.keyDown(document, {key: 'Escape'});
  expect(screen.queryByRole('dialog', {name: '알림'})).toBeNull();
});
