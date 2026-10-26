import type {JSX} from 'react';
import {ListBox, ListRow} from '@renderer/ui';
import {
  selectedIdIn,
  useScreensSelection,
  type ScreensSelectionKind,
} from './selection';
import type {Choice} from './choices';

/**
 * A list of Looks or stage layouts. The row in use shows the LIVE badge and
 * the live bar, the marks the design system allows for what is on the screens;
 * it is not a status chip (docs/spec/06, open question 23).
 */
export function ChoiceList({
  label,
  kind,
  choices,
  inUse,
}: {
  readonly label: string;
  readonly kind: Exclude<ScreensSelectionKind, 'screen'>;
  readonly choices: readonly Choice[];
  readonly inUse: ReadonlySet<string>;
}): JSX.Element {
  const selection = useScreensSelection(view => view.selection);
  const select = useScreensSelection(view => view.select);
  return (
    <ListBox
      label={label}
      selected={selectedIdIn(selection, kind)}
      onSelect={id => select(kind, id)}
    >
      {choices.map(choice => (
        <ListRow
          key={choice.id}
          value={choice.id}
          title={choice.name}
          live={inUse.has(choice.id)}
        />
      ))}
    </ListBox>
  );
}
