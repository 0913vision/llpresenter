import {useState, type JSX} from 'react';
import {Menu, ToolbarButton} from '@renderer/ui';
import {menuButtonProps} from '@renderer/ui/menuButton';
import type {ScreenSummary} from '../../platform/screens';
import {screenOutputEntries} from './screenOutputEntries';

/** Keeps every additional saved output reachable without growing the toolbar. */
export function OutputOverflow({
  screens,
  outputs,
  compact,
}: {
  readonly screens: readonly ScreenSummary[];
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly compact: boolean;
}): JSX.Element {
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <ToolbarButton
        ref={setButton}
        icon="more"
        label="다른 화면"
        title="다른 화면 출력"
        compact={compact}
        iconOnly
        menu
        expanded={open}
        {...menuButtonProps({expanded: open, onExpandedChange: setOpen})}
      />
      {open && button !== null ? (
        <Menu
          label="다른 화면 출력"
          anchor={{kind: 'element', element: button}}
          entries={screenOutputEntries(screens, outputs)}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  );
}
