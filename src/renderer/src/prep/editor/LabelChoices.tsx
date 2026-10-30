import type {JSX, ReactNode} from 'react';
import type {Label} from '@shared/schema/labels';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import type {MenuAnchor} from '@renderer/ui/Menu';
import {menuItemRole, type MenuEntry} from '@renderer/ui/menuModel';
import {Tooltip} from '@renderer/ui/Tooltip';
import {useButtonPress} from '@renderer/ui/press';
import menuStyles from '@renderer/ui/Menu.module.css';
import styles from './LabelMenu.module.css';

export interface LabelContext {
  readonly label: Label;
  readonly anchor: MenuAnchor;
  readonly trigger: HTMLElement;
}

export function LabelChoices({
  entries,
  labels,
  creation,
  onContext,
}: {
  readonly entries: readonly MenuEntry[];
  readonly labels: readonly Label[];
  readonly creation: ReactNode;
  readonly onContext: (context: LabelContext) => void;
}): JSX.Element {
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => {
      const row = entries.find(
        item => item.id === event.currentTarget.dataset.choiceId,
      );
      if (row?.kind === 'item' && !row.disabled) row.onSelect?.();
    },
    onKeyDown: event => {
      const label = labels.find(
        item => `label:${item.name}` === event.currentTarget.dataset.choiceId,
      );
      if (
        label &&
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
      {entries.map(entry => {
        if (entry.kind === 'separator') {
          return (
            <div
              key={entry.id}
              role="separator"
              className={menuStyles.separator}
            />
          );
        }
        if (entry.kind !== 'item') return null;
        if (entry.id === 'new' && creation) {
          return <div key={entry.id}>{creation}</div>;
        }
        const label = labels.find(item => `label:${item.name}` === entry.id);
        return (
          <Tooltip key={entry.id} text={entry.title ?? ''}>
            <button
              {...press}
              type="button"
              role={menuItemRole(entry)}
              aria-checked={entry.check ? entry.checked : undefined}
              aria-disabled={entry.disabled ?? undefined}
              aria-haspopup={label ? 'menu' : undefined}
              data-choice
              data-choice-id={entry.id}
              data-new={entry.id === 'new' || undefined}
              tabIndex={-1}
              className={classNames(menuStyles.item, styles.choice)}
              onContextMenu={event => {
                if (!label) return;
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
              {entry.checked ? (
                <span className={menuStyles.lead}>
                  <Icon name="check" size={14} />
                </span>
              ) : null}
              {entry.swatch === undefined ? null : (
                <span
                  className={menuStyles.swatch}
                  data-color={entry.swatch}
                  style={{backgroundColor: `var(--label-${entry.swatch})`}}
                />
              )}
              <span className={menuStyles.label}>{entry.label}</span>
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}
