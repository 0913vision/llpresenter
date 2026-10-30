import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {parseSettingsDocument} from '@core/schema/settingsDocuments';
import {screensDocument} from '@renderer/screens/testing/documents';
import type {NoticeChanges} from './noticeEdits';
import {NoticeSettings} from './NoticeSettings';

const screens = screensDocument();
if (screens.name !== 'screens') throw new Error('Invalid screens');
const first = screens.value.screens[0];
const second = screens.value.screens[1];
if (!first || !second) throw new Error('Missing screens');
const parsed = parseSettingsDocument({
  name: 'notices',
  revision: 1,
  access: 'editable',
  value: {
    format: 'llsettings.notices',
    schemaVersion: 1,
    sets: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        name: '공지',
        media: ['00000000-0000-4000-8000-000000000002'],
        interval: 8,
        loop: true,
        targets: [first.id],
      },
    ],
  },
});
if (!parsed.ok || parsed.value.name !== 'notices') {
  throw new Error('Invalid notice');
}
const item = parsed.value.value.sets[0];
if (!item) throw new Error('Missing notice');
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('changes repeat and target screens while retaining at least one target', () => {
  const save = vi
    .fn<(changes: NoticeChanges) => Promise<boolean>>()
    .mockResolvedValue(true);
  render(
    <NoticeSettings
      item={item}
      screens={screens.value.screens}
      locked={false}
      save={save}
    />,
  );
  expect(
    screen
      .getByRole('button', {name: first.name})
      .getAttribute('aria-disabled'),
  ).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: second.name}));
  fireEvent.click(screen.getByRole('button', {name: '반복'}));
  expect(save).toHaveBeenNthCalledWith(1, {targets: [first.id, second.id]});
  expect(save).toHaveBeenNthCalledWith(2, {loop: false});
});

it('validates the interval and closes only after a successful save', async () => {
  const save = vi
    .fn<(changes: NoticeChanges) => Promise<boolean>>()
    .mockResolvedValueOnce(false)
    .mockResolvedValue(true);
  render(
    <NoticeSettings
      item={item}
      screens={screens.value.screens}
      locked={false}
      save={save}
    />,
  );
  fireEvent.click(screen.getByRole('button', {name: '8초'}));
  const input = screen.getByRole('textbox', {name: '간격 (초)'});
  fireEvent.change(input, {target: {value: '0'}});
  expect(input.getAttribute('aria-invalid')).toBe('true');
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  expect(save).not.toHaveBeenCalled();
  fireEvent.change(input, {target: {value: '2.5'}});
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(save).toHaveBeenCalledWith({interval: 2.5}));
  expect(screen.getByRole('dialog')).toBeDefined();
  fireEvent.click(screen.getByRole('button', {name: '저장'}));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
});
