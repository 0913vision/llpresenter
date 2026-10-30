import {useEffect, type JSX} from 'react';
import {createPortal} from 'react-dom';
import type {Label} from '@shared/schema/labels';
import {LabelColorPicker} from '@renderer/ui/LabelColorPicker';
import {classNames} from '@renderer/ui/classNames';
import {layerContainer} from '@renderer/ui/layers';
import {useChoicePopup} from '@renderer/ui/useChoicePopup';
import menuStyles from '@renderer/ui/Menu.module.css';
import {editorTask} from './editorTask';
import type {SongEditorStore} from './songEditorStore';
import styles from './LabelMenu.module.css';

export function LabelColorPopover({
  label,
  labels,
  store,
  anchor,
  locked,
  onClose,
}: {
  readonly label: Label;
  readonly labels: readonly Label[];
  readonly store: SongEditorStore;
  readonly anchor: HTMLElement;
  readonly locked: boolean;
  readonly onClose: () => void;
}): JSX.Element {
  const {surface, onKeyDown} = useChoicePopup({
    anchor,
    onClose,
    onEscape: onClose,
  });
  useEffect(() => {
    surface.current
      ?.querySelector<HTMLElement>('[aria-checked="true"]')
      ?.focus();
  }, [surface]);
  return createPortal(
    <div className={menuStyles.layer}>
      <div
        ref={surface}
        role="dialog"
        aria-label={`${label.name} 색`}
        onKeyDown={onKeyDown}
        className={classNames(menuStyles.menu, styles.popup)}
      >
        <fieldset disabled={locked} className={styles.colors}>
          <LabelColorPicker
            label={`${label.name} 색`}
            name={`${label.name} 색`}
            inMenu
            value={label.color}
            disabled={locked}
            scope="모든 곡에 적용"
            onChange={color =>
              editorTask(
                store.updateLabels(
                  labels.map(item =>
                    item.name === label.name ? {...item, color} : item,
                  ),
                ),
              )
            }
          />
        </fieldset>
      </div>
    </div>,
    layerContainer('popover'),
  );
}
