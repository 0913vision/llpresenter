import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, expect, it, vi} from 'vitest';
import * as v from 'valibot';
import {DEFAULT_MESSAGE_STYLE, looksSchema} from '@core/schema/looks';
import {looksDocument, screensDocument} from '../testing/documents';
import {MessageStyleSelect} from './MessageStyleSelect';
import {hoverForTooltip, resetTooltips} from '@renderer/ui/tooltipTesting';

afterEach(cleanup);

function setup(reason?: string) {
  const looks = looksDocument();
  const screens = screensDocument();
  if (looks.name !== 'looks' || screens.name !== 'screens') {
    throw new Error('Wrong fixture');
  }
  const file = v.parse(looksSchema, {
    ...looks.value,
    messageStyles: [
      DEFAULT_MESSAGE_STYLE,
      {
        ...DEFAULT_MESSAGE_STYLE,
        id: '00000000-0000-4000-8000-000000000002',
        name: '방송용',
      },
    ],
  });
  const look = file.looks[0];
  const target = screens.value.screens[0];
  if (look === undefined || target === undefined) {
    throw new Error('Missing fixture');
  }
  const change = vi.fn();
  const create = vi.fn();
  const view = render(
    <MessageStyleSelect
      file={file}
      look={look}
      screenId={target.id}
      screenName={target.name}
      reason={reason}
      onChange={change}
      onCreate={create}
    />,
  );
  return {file, look, target, change, create, ...view};
}

it('chooses an available per-screen style and the default', async () => {
  const {change, file, create} = setup();
  const user = userEvent.setup();
  const button = screen.getByRole('button', {name: '본 화면 메시지 스타일'});
  expect(button.textContent).toContain('기본값');
  await user.click(button);
  await user.click(screen.getByRole('menuitemradio', {name: '방송용'}));
  expect(change).toHaveBeenCalledExactlyOnceWith(file.messageStyles?.[1]?.id);
  await user.click(button);
  await user.click(screen.getByRole('menuitemradio', {name: '기본값'}));
  expect(change).toHaveBeenLastCalledWith(null);
  await user.click(
    screen.getByRole('button', {name: '본 화면 메시지 스타일 추가'}),
  );
  expect(create).toHaveBeenCalledOnce();
});

it('explains a missing style and prevents changes in read-only settings', () => {
  const {file, look, target, change, create, rerender} = setup('읽기 전용');
  const missing = {
    ...look,
    screens: {
      ...look.screens,
      [target.id]: {layers: {}, messageStyle: DEFAULT_MESSAGE_STYLE.id},
    },
  };
  rerender(
    <MessageStyleSelect
      file={{...file, messageStyles: []}}
      look={missing}
      screenId={target.id}
      screenName={target.name}
      reason="읽기 전용"
      onChange={change}
      onCreate={create}
    />,
  );
  const button = screen.getByRole('button', {name: '본 화면 메시지 스타일'});
  expect(button.textContent).toContain('\uAE30\uBCF8\uAC12');
  const description = button.getAttribute('aria-describedby');
  expect(document.getElementById(description ?? '')?.textContent).toContain(
    '\uAE30\uBCF8\uAC12',
  );
  expect(button.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(button);
  expect(change).not.toHaveBeenCalled();
  fireEvent.click(
    screen.getByRole('button', {name: '본 화면 메시지 스타일 추가'}),
  );
  expect(create).not.toHaveBeenCalled();
});

it('warns about a missing reference and preserves it until the operator chooses', async () => {
  const {file, look, target, change, create, rerender} = setup();
  const missing = {
    ...look,
    screens: {
      ...look.screens,
      [target.id]: {layers: {}, messageStyle: DEFAULT_MESSAGE_STYLE.id},
    },
  };
  rerender(
    <MessageStyleSelect
      file={{...file, messageStyles: []}}
      look={missing}
      screenId={target.id}
      screenName={target.name}
      reason={undefined}
      onChange={change}
      onCreate={create}
    />,
  );
  const button = screen.getByRole('button', {name: '본 화면 메시지 스타일'});
  expect(button.textContent).toContain('기본값');
  const description = button.getAttribute('aria-describedby');
  expect(document.getElementById(description ?? '')?.textContent).toContain(
    '메시지 스타일을 찾을 수 없어',
  );
  expect(change).not.toHaveBeenCalled();
  await hoverForTooltip(button);
  expect(screen.getByRole('tooltip').textContent).toContain('기본값');
  resetTooltips();
  vi.useRealTimers();
  await userEvent.click(button);
  await userEvent.click(screen.getByRole('menuitemradio', {name: '기본값'}));
  expect(change).toHaveBeenCalledExactlyOnceWith(null);
});
