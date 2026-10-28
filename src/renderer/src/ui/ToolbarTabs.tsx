import type {JSX, KeyboardEvent} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {useRovingSelection} from './roving';
import {useButtonPress} from './press';
import {toolbarIconSize} from './toolbarLook';
import {titleTooltip, useTooltip} from './Tooltip';
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
  readonly tabs: ReadonlyArray<ToolbarTab<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /** The name of the tab list, such as 작업 공간. */
  readonly label: string;
  readonly compact?: boolean | undefined;
  readonly className?: string | undefined;
}

interface TabButtonProps<T extends string> {
  readonly tab: ToolbarTab<T>;
  readonly selected: boolean;
  readonly compact: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

function TabButton<T extends string>({
  tab,
  selected,
  compact,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: TabButtonProps<T>): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(tab.title));
  const press = useButtonPress<HTMLButtonElement>({
    disabled: tab.disabled === true,
    onPress: onSelect,
    onKeyDown,
    onBlur: targetProps.onBlur,
  });
  return (
    <>
      <button
        {...targetProps}
        {...press}
        ref={elementRef}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-disabled={tab.disabled === true ? true : undefined}
        tabIndex={tabIndex}
        className={classNames(
          styles.button,
          styles.tab,
          compact && styles.compact,
        )}
      >
        <Icon name={tab.icon} size={toolbarIconSize(compact)} />
        <span className={styles.label}>{tab.label}</span>
      </button>
      {tooltip}
    </>
  );
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

  return (
    <div role="tablist" aria-label={label} className={className}>
      {tabs.map((tab, index) => (
        <TabButton
          key={tab.value}
          tab={tab}
          selected={tab.value === value}
          compact={compact}
          tabIndex={roving.tabIndexOf(index)}
          elementRef={roving.refOf(index)}
          onSelect={() => select(tab)}
          onKeyDown={event => roving.onKeyDown(index, event)}
        />
      ))}
    </div>
  );
}
