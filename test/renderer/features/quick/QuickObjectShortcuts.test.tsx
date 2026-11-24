import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import type {WindowShortcut} from '@renderer/platform/shortcuts/windowShortcuts';
import {QuickObjectShortcuts} from '@renderer/features/quick/QuickObjectShortcuts';

const mock = vi.hoisted(() => ({
  bound: false,
  load: vi.fn<(name: string | null, ...rest: unknown[]) => object | null>(),
  register: vi.fn<(commands: readonly WindowShortcut[]) => void>(),
  run: vi.fn<() => Promise<void>>(),
  cancel: vi.fn(),
  unavailable: vi.fn<(item: {kind: string}) => string | undefined>(),
}));
vi.mock('@renderer/platform/shortcuts/useBoundCommands', () => ({
  useBoundCommands: () => () => mock.bound,
}));
vi.mock('@renderer/platform/documents/useSettingsDocument', () => ({
  useSettingsDocument: mock.load,
}));
vi.mock('@renderer/platform/shortcuts/windowShortcuts', () => ({
  useWindowShortcuts: mock.register,
}));
vi.mock('@renderer/features/quick/quickActions', () => ({
  quickRunner: () => ({run: mock.run, cancel: mock.cancel}),
  quickItemUnavailable: mock.unavailable,
}));
afterEach(cleanup);

it('loads assigned quick items, checks availability, and cancels on document change and unmount', async () => {
  mock.bound = false;
  mock.load.mockReturnValue(null);
  mock.run.mockResolvedValue(undefined);
  mock.unavailable.mockImplementation(item =>
    item.kind === 'black' ? 'Unavailable' : undefined,
  );
  const mockLog = vi.fn();
  const api = mockLlpApi({log: {write: mockLog}});
  const onProblem = vi.fn();
  const view = render(<QuickObjectShortcuts api={api} onProblem={onProblem} />);
  expect(mock.load).toHaveBeenLastCalledWith(null, '빠른 실행', onProblem);
  const item = {id: 'macro', kind: 'macro', ref: 'target', name: 'Invented'};
  mock.bound = true;
  mock.load.mockReturnValue({
    value: {
      items: [
        item,
        {id: 'black', kind: 'black'},
        {id: 'future', kind: 'future'},
      ],
    },
  });
  view.rerender(<QuickObjectShortcuts api={api} onProblem={onProblem} />);
  expect(mock.cancel).toHaveBeenCalledTimes(1);
  const commands = mock.register.mock.lastCall?.[0] ?? [];
  expect(commands.map(command => command.id)).toEqual(['quick.macro']);
  const event = new KeyboardEvent('keydown');
  expect(commands[0]?.when?.(event)).toBe(true);
  commands[0]?.run(event);
  expect(mock.run).toHaveBeenCalledExactlyOnceWith(item);
  mock.run.mockRejectedValueOnce(new Error('Invented failure'));
  commands[0]?.run(event);
  await vi.waitFor(() => expect(mockLog).toHaveBeenCalled());
  view.unmount();
  expect(mock.cancel).toHaveBeenCalledTimes(2);
});
