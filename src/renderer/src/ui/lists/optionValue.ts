/**
 * The value of the list row an event happened in: the `data-value` of the
 * nearest option around `target`, as `ListRow` writes it, or undefined outside
 * any row.
 */
export function optionValueAt(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  return target.closest<HTMLElement>('[role="option"][data-value]')?.dataset[
    'value'
  ];
}
