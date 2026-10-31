import type {JSX} from 'react';
import {Icon} from '@renderer/ui/Icon';
import {classNames} from '@renderer/ui/classNames';
import {menuItemRole, type MenuEntry} from '@renderer/ui/menuModel';
import {Tooltip} from '@renderer/ui/Tooltip';
import {useButtonPress} from '@renderer/ui/press';
import menuStyles from '@renderer/ui/Menu.module.css';
import styles from './LabelMenu.module.css';

export function LabelChoices({
  entries,
}: {
  readonly entries: readonly MenuEntry[];
}): JSX.Element {
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => {
      const row = entries.find(
        item => item.id === event.currentTarget.dataset.choiceId,
      );
      if (row?.kind === 'item' && !row.disabled) row.onSelect?.();
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
        return (
          <Tooltip key={entry.id} text={entry.title ?? ''}>
            <button
              {...press}
              type="button"
              role={menuItemRole(entry)}
              aria-checked={entry.check ? entry.checked : undefined}
              aria-disabled={entry.disabled ?? undefined}
              data-choice
              data-choice-id={entry.id}
              tabIndex={-1}
              className={classNames(menuStyles.item, styles.choice)}
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
