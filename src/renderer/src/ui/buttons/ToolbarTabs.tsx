import type {JSX, KeyboardEvent} from 'react';
import {classNames} from '../classNames';
import {Icon} from '../Icon';
import {useRovingSelection} from '../lists/roving';
import {useTabButton} from './tabButton';
import {toolbarIconSize} from './toolbarIcons';
import styles from './ToolbarButton.module.css';

/** One tab of a toolbar tab group: an icon with its name. */
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
  readonly keepPointerFocus?: boolean | undefined;
}

interface TabButtonProps<T extends string> {
  readonly tab: ToolbarTab<T>;
  readonly selected: boolean;
  readonly compact: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
  readonly keepPointerFocus: boolean;
}

function TabButton<T extends string>({
  tab,
  selected,
  compact,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
  keepPointerFocus,
}: TabButtonProps<T>): JSX.Element {
  const {props, tooltip} = useTabButton({
    title: tab.title,
    disabled: tab.disabled === true,
    selected,
    onSelect,
    onKeyDown,
  });
  return (
    <>
      <button
        {...props}
        onMouseDown={event => {
          if (keepPointerFocus && event.button === 0) event.preventDefault();
        }}
        ref={elementRef}
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
  keepPointerFocus = false,
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
          keepPointerFocus={keepPointerFocus}
        />
      ))}
    </div>
  );
}
