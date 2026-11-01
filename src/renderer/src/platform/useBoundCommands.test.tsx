import {act, cleanup, renderHook} from '@testing-library/react';
import {afterEach, expect, it} from 'vitest';
import {commandBindingStore} from '@renderer/ui/commandBindings';
import {useBoundCommands} from './useBoundCommands';

afterEach(() => {
  cleanup();
  commandBindingStore.set({});
});

it('tracks assigned prefixes and ignores empty bindings', () => {
  const {result} = renderHook(useBoundCommands);
  expect(result.current('macro.')).toBe(false);
  act(() =>
    commandBindingStore.set({
      'macro.one': [{code: 'F8', mods: []}],
      'quick.one': [],
    }),
  );
  expect(result.current('macro.')).toBe(true);
  expect(result.current('quick.')).toBe(false);
  act(() => commandBindingStore.set({}));
  expect(result.current('macro.')).toBe(false);
});
