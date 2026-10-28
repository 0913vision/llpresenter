import type {JSX} from 'react';
import type {Label} from '@shared/schema/labels';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {useButtonPress} from '@renderer/ui/press';
import menuStyles from '@renderer/ui/Menu.module.css';
import styles from './LabelMenu.module.css';

export interface LabelContext {
  readonly label: Label;
  readonly anchor: MenuAnchor;
  readonly trigger: HTMLElement;
}

interface ChoicesProps {
  readonly labels: readonly Label[];
  readonly selected: string | undefined;
  readonly onChoose: (name: string | undefined) => void;
  readonly onContext: (context: LabelContext) => void;
}

/** Menu-sized label choices with their shared colors. */
export function LabelChoices({
  labels,
  selected,
  onChoose,
  onContext,
}: ChoicesProps): JSX.Element {
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => onChoose(event.currentTarget.dataset.labelName),
    onKeyDown: event => {
      const label = labels.find(
        item => item.name === event.currentTarget.dataset.labelName,
      );
      if (
        label !== undefined &&
        (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey))
      ) {
        event.preventDefault();
        event.stopPropagation();
        onContext({
          label,
          trigger: event.currentTarget,
          anchor: {kind: 'element', element: event.currentTarget},
        });
      }
    },
  });
  return (
    <div className={menuStyles.scroll}>
      <button
        {...press}
        type="button"
        role="menuitemradio"
        aria-checked={selected === undefined}
        data-choice
        tabIndex={-1}
        className={classNames(menuStyles.item, styles.choice)}
      >
        <span className={menuStyles.lead}>
          {selected === undefined ? <Icon name="check" size={14} /> : null}
        </span>
        <span className={menuStyles.swatch} data-color="none" />
        <span className={menuStyles.label}>이름표 없음</span>
      </button>
      {labels.map(label => {
        return (
          <button
            {...press}
            key={label.name}
            type="button"
            role="menuitemradio"
            aria-checked={label.name === selected}
            aria-haspopup="menu"
            data-choice
            data-label-name={label.name}
            tabIndex={-1}
            className={classNames(menuStyles.item, styles.choice)}
            onContextMenu={event => {
              event.preventDefault();
              onContext({
                label,
                trigger: event.currentTarget,
                anchor: {
                  kind: 'point',
                  point: {x: event.clientX, y: event.clientY},
                },
              });
            }}
          >
            <span className={menuStyles.lead}>
              {label.name === selected ? <Icon name="check" size={14} /> : null}
            </span>
            <span
              className={menuStyles.swatch}
              data-color={label.color}
              style={{backgroundColor: `var(--label-${label.color})`}}
            />
            <span className={menuStyles.label}>{label.name}</span>
          </button>
        );
      })}
    </div>
  );
}
