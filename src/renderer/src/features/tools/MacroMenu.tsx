import type {JSX} from 'react';
import {Menu, type MenuAnchor} from '@renderer/ui/Menu';
import type {Notice} from '@renderer/ui/notices';
import {
  macroMenuEntries,
  type MacroMenuHandlers,
  type MacroMenuInput,
} from './macroMenuEntries';
import {useMacroTargets} from './useMacroTargets';

/**
 * The 매크로 right-click menu. It loads the action targets so that each
 * action row can name its target ("동작 편집: 찬양").
 */
export function MacroMenu({
  input,
  handlersFor,
  anchor,
  onClose,
  onProblem,
}: {
  readonly input: Omit<MacroMenuInput, 'targets'>;
  /** Builds the commands for the 매크로 the menu shows. */
  readonly handlersFor: (item: MacroMenuInput['item']) => MacroMenuHandlers;
  readonly anchor: MenuAnchor;
  readonly onClose: () => void;
  readonly onProblem: ((notice: Notice) => void) | undefined;
}): JSX.Element {
  const targets = useMacroTargets(onProblem);
  return (
    <Menu
      label="매크로"
      anchor={anchor}
      onClose={onClose}
      entries={macroMenuEntries(
        {...input, targets: targets?.choices},
        handlersFor(input.item),
      )}
    />
  );
}
