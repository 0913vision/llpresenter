import {useEffect, useRef, type JSX} from 'react';
import type {PaletteColor} from '@core/labels';
import {MacroColorPicker} from '@renderer/ui/labels/LabelColorPicker';
import {useChoicePopup} from '@renderer/ui/choices/useChoicePopup';
import {Popover} from '@renderer/ui/popups/Popover';
import menuStyles from '@renderer/ui/menus/Menu.module.css';
import styles from './MacroPanel.module.css';
import {returnFocus} from '@renderer/ui/keys/returnFocus';

export function MacroColorPopover({
  anchor,
  value,
  locked,
  onChange,
  onClose,
}: {
  readonly anchor: HTMLElement;
  readonly value: PaletteColor;
  readonly locked: boolean;
  readonly onChange: (color: PaletteColor) => void;
  readonly onClose: () => void;
}): JSX.Element {
  const restoreFocus = useRef(true);
  const ready = useRef(false);
  const close = (restore: boolean): void => {
    restoreFocus.current = restore;
    onClose();
  };
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    onClose: close,
    onEscape: () => close(true),
  });
  useEffect(() => {
    surface.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.focus();
    ready.current = true;
    return () => {
      ready.current = false;
      if (restoreFocus.current && anchor.isConnected) returnFocus(anchor);
    };
  }, [surface, anchor]);
  return (
    <Popover>
      <div className={menuStyles.layer}>
        <div
          ref={surface}
          role="dialog"
          aria-label="매크로 색"
          className={`${menuStyles.menu} ${styles.colors}`}
          onKeyDown={onKeyDown}
          onBlur={event => {
            if (
              ready.current &&
              !(
                event.relatedTarget instanceof Node &&
                event.currentTarget.contains(event.relatedTarget)
              )
            ) {
              close(false);
            }
          }}
        >
          <MacroColorPicker
            label="매크로 색"
            value={value}
            disabled={locked}
            onChange={onChange}
          />
        </div>
      </div>
    </Popover>
  );
}
