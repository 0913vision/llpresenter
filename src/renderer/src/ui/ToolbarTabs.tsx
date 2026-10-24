import type {JSX} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
import {toolbarIconSize} from './toolbarLook';
import styles from './ToolbarButton.module.css';

export interface ToolbarTab<T extends string> {
  readonly value: T;
  readonly icon: string;
  readonly label: string;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the tab is disabled. */
  readonly title?: string | undefined;
}

export interface ToolbarTabsProps<T extends string> {
  readonly tabs: readonly ToolbarTab<T>[];
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** The name of the tab list, such as 작업 공간. */
  readonly label: string;
  readonly compact?: boolean | undefined;
  readonly className?: string | undefined;
}

/**
 * The workspace tabs on the toolbar. Left and Right switch tabs at once, and
 * Tab stops only on the selected tab.
 */
export function ToolbarTabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  compact = false,
  className,
}: ToolbarTabsProps<T>): JSX.Element {
  const roving = useRovingSelection({
    items: tabs,
    value,
    onChange,
    disabled: false,
  });

  const select = (tab: ToolbarTab<T>): void => {
    if (tab.disabled === true || tab.value === value) return;
    onChange(tab.value);
  };

  // TODO(0913vision): Draw `title` with Tooltip once ui-2 lands.
  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((tab, index) => (
        <button
          key={tab.value}
          ref={roving.refOf(index)}
          type="button"
          role="tab"
          aria-selected={tab.value === value}
          aria-disabled={tab.disabled === true ? true : undefined}
          tabIndex={roving.tabIndexOf(index)}
          title={tab.title}
          className={classNames(
            styles.button,
            styles.tab,
            compact && styles.compact,
          )}
          onClick={() => select(tab)}
          onKeyDown={event => roving.onKeyDown(index, event)}
        >
          <Icon name={tab.icon} size={toolbarIconSize(compact)} />
          <span className={styles.label}>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
