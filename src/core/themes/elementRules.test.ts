import {expect, it} from 'vitest';
import {
  isStandbyElement,
  themeElementKinds,
  themeElementProblem,
  availableThemeElementKinds,
} from './elementRules';

it('offers unused unique kinds even at the count limit while keeping repeatable and standby choices', () => {
  const values = [
    {kind: 'currentText'} as const,
    ...Array.from({length: 9}, () => ({kind: 'text'}) as const),
  ];
  const choices = availableThemeElementKinds(values, 'audience', false);
  expect(choices).not.toContain('currentText');
  expect(choices).toContain('text');
  expect(choices).not.toContain('memo');
  expect(availableThemeElementKinds([], 'stage', true)).toEqual([
    'text',
    'image',
    'box',
    'clock',
  ]);
});

it.each(themeElementKinds)(
  'enforces multiplicity and screen roles for %s',
  kind => {
    const repeatable = ['text', 'image', 'box', 'timer'].includes(kind);
    const stageOnly = ['stageMessage', 'memo'].includes(kind);
    expect(themeElementProblem([{kind}, {kind}], 'stage')).toEqual(
      repeatable ? undefined : {reason: 'duplicate-kind', kind},
    );
    expect(themeElementProblem([{kind}], 'audience')).toEqual(
      stageOnly ? {reason: 'stage-only', kind} : undefined,
    );
    expect(isStandbyElement(kind)).toBe(
      ['text', 'image', 'box', 'clock'].includes(kind),
    );
  },
);

it('allows ten repeatable elements and refuses an eleventh', () => {
  const elements = Array.from({length: 10}, () => ({kind: 'text'}) as const);
  expect(themeElementProblem(elements)).toBeUndefined();
  expect(themeElementProblem([...elements, {kind: 'text'}])).toEqual({
    reason: 'too-many',
  });
});
