import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {ScreenGroupActions} from './ScreenGroupActions';
import {wideMonitorArrangement} from './testing/monitorArrangement';

afterEach(cleanup);

it('lets modified navigation reach window shortcuts without selecting a row', () => {
  const keyDown = vi.fn();
  const toggle = vi.fn();
  render(
    <div onKeyDown={keyDown}>
      <ScreenGroupActions
        kind="audience"
        label="Audience"
        reason={undefined}
        outputReason={undefined}
        on={false}
        monitors={[]}
        add={vi.fn()}
        toggle={toggle}
      />
    </div>,
  );
  const button = screen.getAllByRole('button')[0];
  if (button === undefined) {
    throw new Error('Missing group action');
  }
  fireEvent.keyDown(button, {key: 'ArrowDown'});
  expect(keyDown).not.toHaveBeenCalled();
  fireEvent.keyDown(button, {key: 'ArrowDown', ctrlKey: true});
  fireEvent.keyDown(button, {key: 'ArrowUp', shiftKey: true});
  fireEvent.keyDown(button, {key: 'Home', metaKey: true});
  fireEvent.keyDown(button, {key: 'End', altKey: true});
  expect(keyDown).toHaveBeenCalledTimes(4);
  expect(toggle).not.toHaveBeenCalled();
});

it.each(['audience', 'stage'] as const)(
  'lists the grouped %s add menu rows and highlights each monitor in its thumbnail',
  kind => {
    const add = vi.fn();
    render(
      <ScreenGroupActions
        kind={kind}
        label="화면"
        reason={undefined}
        outputReason={undefined}
        on={false}
        monitors={wideMonitorArrangement}
        add={add}
        toggle={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: '새 화면 화면'}));
    const menu = screen.getByRole('menu');
    for (const name of ['모니터', '창', 'NDI', '자리 표시']) {
      expect(within(menu).getByRole('group', {name})).toBeDefined();
    }
    expect(
      [...menu.querySelectorAll('[role="menuitem"], [role="separator"]')].map(
        row =>
          row.getAttribute('role') === 'separator' ? '|' : row.textContent,
      ),
    ).toEqual([
      '모니터 1(3440×1440)',
      '모니터 2(1920×1080)',
      '새 창',
      '새 캡처 창',
      '새 NDI',
      '새 자리 표시',
      ...(kind === 'audience' ? ['|', '묶음…', '가장자리 합성…'] : []),
    ]);
    for (const name of [
      '새 NDI',
      '새 자리 표시',
      ...(kind === 'audience' ? ['묶음…', '가장자리 합성…'] : []),
    ]) {
      const row = within(menu).getByRole('menuitem', {name});
      expect(row.getAttribute('aria-disabled')).toBe('true');
      fireEvent.click(row);
    }
    expect(add).not.toHaveBeenCalled();
    const control = within(menu).getByRole('menuitem', {name: /모니터 1/});
    expect(
      control
        .querySelector('[data-selected="true"]')
        ?.getAttribute('data-monitor'),
    ).toBe('1');
    expect(control.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(control);
    expect(add).not.toHaveBeenCalled();
    const projector = within(menu).getByRole('menuitem', {name: /모니터 2/});
    const thumbnail = projector.querySelector('svg');
    expect(thumbnail?.getAttribute('aria-hidden')).toBe('true');
    expect(thumbnail?.querySelectorAll('rect')).toHaveLength(2);
    expect(
      thumbnail
        ?.querySelector('[data-selected="true"]')
        ?.getAttribute('data-monitor'),
    ).toBe('2');
    fireEvent.click(projector);
    expect(add).toHaveBeenCalledExactlyOnceWith(
      kind,
      'fullscreen',
      wideMonitorArrangement[1],
    );
  },
);
