import {useEffect, useRef, type JSX} from 'react';
import {createPortal} from 'react-dom';
import type {PaletteColor} from '@shared/colors';
import {MacroColorPicker} from '@renderer/ui/LabelColorPicker';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import {layerContainer} from '@renderer/ui/layers';
import menuStyles from '@renderer/ui/Menu.module.css';
import styles from './MacroPanel.module.css';

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
      if (restoreFocus.current && anchor.isConnected) anchor.focus();
    };
  }, [surface, anchor]);
  return createPortal(
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
    </div>,
    layerContainer('popover'),
  );
}
