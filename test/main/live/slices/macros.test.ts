import {expect, it, vi} from 'vitest';
import {emptyLiveState} from '@core/live/state';
import {parseMacroId} from '@core/schema/ids';
import type {LiveHistory} from '@main/live/history';
import type {MacroCommandPort, SliceContext} from '@main/live/slice';
import {macrosSlice} from '@main/live/slices/macros';
import {expectSuccess} from '@fixtures/core/schema/testHelpers';

const command = {
  type: 'macro.run',
  macroId: expectSuccess(parseMacroId('00000000-0000-4000-8000-000000000020')),
} as const;

function context(macros?: MacroCommandPort): SliceContext {
  return {
    now: 0,
    ...(macros === undefined ? {} : {macros}),
    defer: vi.fn(),
    ranMacro: vi.fn(),
    reject: vi.fn(() => history()),
    apply: vi.fn(),
  };
}

function history(): LiveHistory {
  return {state: emptyLiveState(), undo: null};
}

it('hands a 매크로 command to the connected runtime', () => {
  const after = history();
  const macros: MacroCommandPort = {run: vi.fn(() => after)};
  const input = context(macros);
  const before = history();

  expect(macrosSlice.apply(before, command, input)).toBe(after);
  expect(macros.run).toHaveBeenCalledExactlyOnceWith(before, command, input);
});

it('rejects a 매크로 command while no runtime is connected', () => {
  const input = context();

  macrosSlice.apply(history(), command, input);

  expect(input.reject).toHaveBeenCalledExactlyOnceWith({
    field: 'macroId',
    message: 'Macro execution is not ready',
  });
});
