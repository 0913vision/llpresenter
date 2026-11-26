import {expect, it} from 'vitest';
import {tokenPixels} from '@renderer/ui/tokenPixels';

function styleOf(values: Record<string, string>) {
  return {getPropertyValue: (name: string) => values[name] ?? ''};
}

it('reads a size token of the style sheet in pixels', () => {
  expect(tokenPixels(styleOf({'--size-row': ' 28px'}), '--size-row')).toBe(28);
  expect(tokenPixels(styleOf({'--space-12': '12.5px'}), '--space-12', 4)).toBe(
    12.5,
  );
});

it('takes the fallback for a token that is unset, not a number, or zero', () => {
  expect(tokenPixels(styleOf({}), '--size-row')).toBe(0);
  expect(tokenPixels(styleOf({}), '--space-16', 16)).toBe(16);
  expect(tokenPixels(styleOf({'--space-16': 'auto'}), '--space-16', 16)).toBe(
    16,
  );
  expect(tokenPixels(styleOf({'--space-16': '0px'}), '--space-16', 16)).toBe(
    16,
  );
});
