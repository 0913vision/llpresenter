import {fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {useState, type JSX} from 'react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {installFakeClock} from '../../../../test/fake-clock';
import {cssRules} from '@renderer/ui/testing/cssRules';
import {Dialog} from './Dialog';
import {modalStack} from './modalStack';
import {
  NOTICE_LIFETIME_MS,
  NotificationCard,
  NotificationStack,
} from './Notification';
import {removeNotice, type Notice} from './notices';
import {letTimePass, resetTooltips} from './tooltipTesting';
import styles from './Notification.module.css';

afterEach(resetTooltips);

const lost: Notice = {
  key: 'screen:stage',
  kind: 'warning',
  icon: 'plug',
  title: '무대 모니터 연결 끊김',
  time: '11:24',
  meta: ['모니터 3', '창으로 표시 중'],
  actions: [
    {icon: 'refresh', label: '모니터 다시 찾기', onSelect: () => {}},
    {icon: 'open', label: '창 보기', onSelect: () => {}},
  ],
};

const back: Notice = {
  key: 'screen:main',
  kind: 'info',
  icon: 'monitor',
  title: '본 모니터 다시 연결됨',
  time: '11:26',
  meta: ['모니터 2'],
};

function Stack({
  initial,
  onWarningHeightChange,
}: {
  readonly initial: readonly Notice[];
  readonly onWarningHeightChange?: (height: number) => void;
}): JSX.Element {
  const [notices, setNotices] = useState(initial);
  return (
    <NotificationStack
      notices={notices}
      onClose={key => setNotices(removeNotice(notices, key))}
      onWarningHeightChange={onWarningHeightChange}
    />
  );
}

describe('NotificationCard', () => {
  it('centers the separator outside the text baseline and keeps details bounded', () => {
    render(<NotificationCard notice={lost} onClose={() => {}} />);
    expect(screen.getByRole('img', {name: '에서'}).classList).toContain(
      styles.separator,
    );
    const rule = cssRules('src/renderer/src/ui/Notification.module.css');
    expect(rule('.separator')).toContain('display: inline-flex');
    expect(rule('.separator')).toContain('align-items: center');
    expect(rule('.meta')).toContain('flex-wrap: wrap');
    expect(rule('.value')).toContain('overflow-wrap: anywhere');
    expect(rule('.head')).toContain('min-height: var(--size-control-sm)');
    expect(rule('.card .close')).not.toContain('margin-top');
  });

  it('uses an inset popover surface with immediate arrival and dismissal', () => {
    const rule = cssRules('src/renderer/src/ui/Notification.module.css');
    expect(rule('.stack')).toContain(
      'padding: var(--space-8) var(--space-8) 0',
    );
    expect(rule('.stack')).toContain('pointer-events: none');
    expect(rule('.card')).toContain('pointer-events: auto');
    expect(rule('.card')).toContain('border-radius: var(--radius-lg)');
    expect(rule('.card')).toContain('box-shadow: var(--shadow-popover)');
    expect(rule('.card')).toContain('animation: none');
    expect(rule('.card')).toContain('transition: none');
  });

  it('raises a warning as an alert named by its title', () => {
    render(<NotificationCard notice={lost} onClose={() => {}} />);
    const alert = screen.getByRole('alert', {name: '무대 모니터 연결 끊김'});
    expect(alert.getAttribute('data-state')).toBe('warning');
    expect(alert.textContent).toContain('11:24');
    expect(screen.getByRole('img', {name: '에서'})).toBeDefined();
  });

  it('reports information as a status', () => {
    render(<NotificationCard notice={back} onClose={() => {}} />);
    expect(
      screen.getByRole('status', {name: '본 모니터 다시 연결됨'}),
    ).toBeDefined();
  });

  it('runs an action and closes from its close button', async () => {
    const onSelect = vi.fn<() => void>();
    const onClose = vi.fn<(key: string) => void>();
    render(
      <NotificationCard
        notice={{
          ...lost,
          actions: [{icon: 'open', label: '창 보기', onSelect}],
        }}
        onClose={onClose}
      />,
    );
    await userEvent.click(screen.getByRole('button', {name: '창 보기'}));
    await userEvent.click(screen.getByRole('button', {name: '알림 닫기'}));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledWith('screen:stage');
  });

  it('closes information after six seconds and keeps a warning', async () => {
    const clock = installFakeClock();
    const onClose = vi.fn<(key: string) => void>();
    render(
      <>
        <NotificationCard notice={back} onClose={onClose} />
        <NotificationCard notice={lost} onClose={onClose} />
      </>,
    );
    await letTimePass(clock, NOTICE_LIFETIME_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    await letTimePass(clock, 1);
    expect(onClose.mock.calls).toEqual([['screen:main']]);
    await letTimePass(clock, NOTICE_LIFETIME_MS * 10);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('waits while the pointer is over it and counts six seconds again after', async () => {
    const clock = installFakeClock();
    const onClose = vi.fn<(key: string) => void>();
    render(<NotificationCard notice={back} onClose={onClose} />);
    const card = screen.getByRole('status');
    await letTimePass(clock, NOTICE_LIFETIME_MS - 1000);
    fireEvent.pointerOver(card);
    await letTimePass(clock, NOTICE_LIFETIME_MS * 2);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerOut(card);
    await letTimePass(clock, NOTICE_LIFETIME_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    await letTimePass(clock, 1);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('waits while focus is inside it', async () => {
    const clock = installFakeClock();
    const onClose = vi.fn<(key: string) => void>();
    render(
      <>
        <NotificationCard notice={back} onClose={onClose} />
        <button type="button">밖</button>
      </>,
    );
    screen.getByRole('button', {name: '알림 닫기'}).focus();
    await letTimePass(clock, NOTICE_LIFETIME_MS * 2);
    expect(onClose).not.toHaveBeenCalled();
    screen.getByRole('button', {name: '밖'}).focus();
    await letTimePass(clock, NOTICE_LIFETIME_MS);
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('NotificationStack', () => {
  it('shows its cards first in the page, outside a dialog that makes the app inert', () => {
    render(<Stack initial={[lost, back]} />);
    const layer = screen.getByRole('alert').closest('[data-llp-layer]');
    expect(layer?.getAttribute('data-llp-layer')).toBe('notification');
    expect(document.body.firstElementChild).toBe(layer);
    const dialog = document.createElement('div');
    document.body.append(dialog);
    const close = modalStack.push(dialog);
    expect(layer?.hasAttribute('inert')).toBe(false);
    close();
    dialog.remove();
  });

  it('gives an information card that replaces another its full six seconds', async () => {
    const clock = installFakeClock();
    const onClose = vi.fn<(key: string) => void>();
    const {rerender} = render(
      <NotificationStack notices={[back]} onClose={onClose} />,
    );
    await letTimePass(clock, NOTICE_LIFETIME_MS - 1000);
    const again: Notice = {...back, time: '11:31'};
    rerender(<NotificationStack notices={[again]} onClose={onClose} />);
    await letTimePass(clock, NOTICE_LIFETIME_MS - 1);
    expect(onClose).not.toHaveBeenCalled();
    await letTimePass(clock, 1);
    expect(onClose.mock.calls).toEqual([['screen:main']]);
  });

  it('joins the Tab cycle of an open dialog, before the dialog', async () => {
    render(
      <>
        <NotificationStack notices={[lost]} onClose={() => {}} />
        <Dialog
          title="새 예배"
          size="s"
          onCancel={() => {}}
          primary={{label: '만들기', onSelect: () => {}}}
        >
          본문
        </Dialog>
      </>,
    );
    const button = (name: string): HTMLElement =>
      screen.getByRole('button', {name});
    const order = ['모니터 다시 찾기', '창 보기', '알림 닫기', '닫기', '취소'];
    button('만들기').focus();
    for (const name of order) {
      await userEvent.tab();
      expect(document.activeElement).toBe(button(name));
    }
    for (const name of order.toReversed().slice(1)) {
      await userEvent.tab({shift: true});
      expect(document.activeElement).toBe(button(name));
    }
    await userEvent.tab({shift: true});
    expect(document.activeElement).toBe(button('만들기'));
  });

  it('cancels the open dialog once on Esc from a card, and the card stays', async () => {
    const onCancel = vi.fn();
    render(
      <>
        <NotificationStack notices={[lost]} onClose={() => {}} />
        <Dialog
          title="새 예배"
          size="s"
          onCancel={onCancel}
          primary={{label: '만들기', onSelect: () => {}}}
        >
          본문
        </Dialog>
      </>,
    );
    screen.getByRole('button', {name: '창 보기'}).focus();
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
    expect(screen.getByRole('alert')).toBeDefined();
  });

  it('takes a closed card off', async () => {
    render(<Stack initial={[lost, back]} />);
    await userEvent.click(
      screen.getAllByRole('button', {name: '알림 닫기'})[0] ?? document.body,
    );
    expect(screen.queryByRole('alert')).toBe(null);
    expect(screen.getByRole('status')).toBeDefined();
  });

  it('reports how far the warning cards reach, and 0 without one', async () => {
    const tops: Readonly<Record<string, DOMRect>> = {
      alert: new DOMRect(0, 90, 480, 96),
      status: new DOMRect(0, 190, 480, 60),
    };
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement): DOMRect {
        return (
          tops[this.getAttribute('role') ?? ''] ?? new DOMRect(0, 90, 480, 160)
        );
      },
    );
    const onHeight = vi.fn<(height: number) => void>();
    render(<Stack initial={[lost, back]} onWarningHeightChange={onHeight} />);
    expect(onHeight).toHaveBeenLastCalledWith(96);
    const alert = screen.getByRole('alert');
    const close = alert.querySelector('button[aria-label="알림 닫기"]');
    if (close === null) throw new Error('No close button');
    await userEvent.click(close);
    expect(onHeight).toHaveBeenLastCalledWith(0);
    expect(onHeight).toHaveBeenCalledTimes(2);
  });
});
