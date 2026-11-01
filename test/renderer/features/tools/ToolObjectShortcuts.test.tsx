import {cleanup, render} from '@testing-library/react';
import {afterEach, expect, it, vi} from 'vitest';
import type {WindowShortcut} from '@renderer/platform/windowShortcuts';
import {sendLive} from '@renderer/session/live';
import {
  toggleProp,
  toggleTimer,
  resetTimer,
} from '@renderer/features/tools/toolCommands';
import {ToolObjectShortcuts} from '@renderer/features/tools/ToolObjectShortcuts';

const mock = vi.hoisted(() => ({
  bound: false,
  load: vi.fn<(name: string | null, ...rest: unknown[]) => object | null>(),
  register: vi.fn<(commands: readonly WindowShortcut[]) => void>(),
}));
vi.mock('@renderer/platform/useBoundCommands', () => ({
  useBoundCommands: () => () => mock.bound,
}));
vi.mock('@renderer/platform/useSettingsDocument', () => ({
  useSettingsDocument: mock.load,
}));
vi.mock('@renderer/platform/windowShortcuts', () => ({
  useWindowShortcuts: mock.register,
}));
vi.mock('@renderer/session/live', () => ({sendLive: vi.fn()}));
vi.mock('@renderer/features/tools/toolCommands', () => ({
  toggleProp: vi.fn(),
  toggleTimer: vi.fn(),
  resetTimer: vi.fn(),
}));
afterEach(cleanup);

it('loads only bound tool settings and registers their existing commands without a panel', () => {
  mock.bound = false;
  mock.load.mockImplementation(() => null);
  const onProblem = vi.fn();
  const view = render(
    <ToolObjectShortcuts api={undefined} onProblem={onProblem} />,
  );
  expect(mock.load.mock.calls.map(call => call[0])).toEqual([null, null, null]);
  expect(mock.register).toHaveBeenLastCalledWith([]);
  const timer = {id: 'timer', kind: 'countdown', duration: 60};
  const documents = new Map<string, object>([
    ['macros', {value: {macros: [{id: 'macro'}]}}],
    ['props', {value: {props: [{id: 'prop'}]}}],
    ['timers', {value: {timers: [timer]}}],
  ]);
  mock.bound = true;
  mock.load.mockImplementation(name =>
    name === null ? null : (documents.get(name) ?? null),
  );
  view.rerender(<ToolObjectShortcuts api={undefined} onProblem={onProblem} />);
  const commands = mock.register.mock.lastCall?.[0] ?? [];
  expect(commands.map(command => command.id)).toEqual([
    'macro.macro',
    'prop.prop',
    'timer.timer.toggle',
    'timer.timer.reset',
  ]);
  for (const command of commands) command.run(new KeyboardEvent('keydown'));
  expect(sendLive).toHaveBeenCalledExactlyOnceWith({
    type: 'macro.run',
    macroId: 'macro',
  });
  expect(toggleProp).toHaveBeenCalledExactlyOnceWith('prop');
  expect(toggleTimer).toHaveBeenCalledExactlyOnceWith(timer);
  expect(resetTimer).toHaveBeenCalledExactlyOnceWith(timer);
});
