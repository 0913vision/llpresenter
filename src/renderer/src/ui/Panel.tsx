import {
  createContext,
  useContext,
  useId,
  useState,
  type JSX,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import {classNames} from './classNames';
import {Icon} from './Icon';
import {Menu} from './Menu';
import {menuButtonProps} from './menuButton';
import {useButtonPress} from './press';
import {useRovingSelection} from './roving';
import {CountBadge} from './StatusMarks';
import {titleTooltip, useTooltip, withTooltipProps} from './Tooltip';
import {TruncatedText} from './TruncatedText';
import styles from './Panel.module.css';

const SWITCH_CHEVRON_SIZE = 12;

const PanelIdBase = createContext<string>('panel');

function tabId(base: string, value: string): string {
  return `${base}-tab-${value}`;
}

/** A row or column of panels with the 4px `bg-app` gap between them. */
export function Panels({
  direction = 'row',
  windowEdges = false,
  className,
  children,
}: {
  readonly direction?: 'row' | 'column' | undefined;
  /** Adds the 4px gap at the left and right window edges. */
  readonly windowEdges?: boolean | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <div
      className={classNames(
        styles.panels,
        direction === 'column' && styles.column,
        windowEdges && styles.window,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** The basic surface: a header, a scrolling body, and an optional footer. */
export function Panel({
  label,
  className,
  children,
}: {
  /** The panel name, such as 예배 순서. */
  readonly label: string;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const base = useId();
  return (
    <PanelIdBase value={base}>
      <section
        aria-label={label}
        className={classNames(styles.panel, className)}
      >
        {children}
      </section>
    </PanelIdBase>
  );
}

/** The 34px header row. */
export function PanelHeader({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className={styles.header}>{children}</div>;
}

export interface PanelTab<T extends string> {
  readonly value: T;
  readonly label: string;
  /** A count badge after the name; hidden at zero. */
  readonly count?: number | undefined;
  readonly disabled?: boolean | undefined;
  /** Tooltip text, such as the reason the tab is disabled. */
  readonly title?: string | undefined;
}

interface PanelTabButtonProps<T extends string> {
  readonly tab: PanelTab<T>;
  readonly selected: boolean;
  readonly tabIndex: 0 | -1;
  readonly elementRef: (element: HTMLElement | null) => void;
  readonly onSelect: () => void;
  readonly onKeyDown: (event: KeyboardEvent) => void;
}

function tabLabel<T extends string>(tab: PanelTab<T>): string | undefined {
  return tab.count === undefined || tab.count <= 0
    ? undefined
    : `${tab.label} ${tab.count}개`;
}

function PanelTabButton<T extends string>({
  tab,
  selected,
  tabIndex,
  elementRef,
  onSelect,
  onKeyDown,
}: PanelTabButtonProps<T>): JSX.Element {
  const base = useContext(PanelIdBase);
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
        id={tabId(base, tab.value)}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-label={tabLabel(tab)}
        aria-disabled={tab.disabled === true ? true : undefined}
        tabIndex={tabIndex}
        className={styles.tab}
      >
        {tab.label}
        {tab.count === undefined ? null : <CountBadge value={tab.count} />}
      </button>
      {tooltip}
    </>
  );
}

/** Tabs that don't fit the header, behind one menu button. */
export interface PanelTabsMore<T extends string> {
  /** The button name, such as 더 보기. */
  readonly label: string;
  readonly tabs: ReadonlyArray<PanelTab<T>>;
}

export interface PanelTabsProps<T extends string> {
  readonly tabs: ReadonlyArray<PanelTab<T>>;
  readonly value: T;
  readonly onChange: (value: T) => void;
  /**
   * The rest of the tabs at the right end of the header, as in the narrow
   * 진행 도구 panel. The button shows as the selected tab while one of its
   * tabs is.
   */
  readonly more?: PanelTabsMore<T> | undefined;
}

function PanelMoreTabs<T extends string>({
  more,
  value,
  onChange,
}: {
  readonly more: PanelTabsMore<T>;
  readonly value: T;
  readonly onChange: (value: T) => void;
}): JSX.Element {
  const base = useContext(PanelIdBase);
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const current = more.tabs.find(tab => tab.value === value);
  const active = current !== undefined;
  const menuProps = menuButtonProps({expanded, onExpandedChange: setExpanded});
  const press = useButtonPress({
    disabled: false,
    onPress: menuProps.onClick,
    onKeyDown: menuProps.onKeyDown,
  });
  return (
    <>
      <button
        ref={setButton}
        type="button"
        {...menuProps}
        {...press}
        data-active={active || undefined}
        className={styles.more}
      >
        {more.label}
        <Icon
          name="down"
          size={SWITCH_CHEVRON_SIZE}
          className={styles.moreChevron}
        />
      </button>
      {current === undefined ? null : (
        <span id={tabId(base, current.value)} hidden>
          {tabLabel(current) ?? current.label}
        </span>
      )}
      {expanded && button !== null ? (
        <Menu
          label={more.label}
          anchor={{kind: 'element', element: button}}
          onClose={() => setExpanded(false)}
          entries={more.tabs.map(tab => ({
            kind: 'item',
            id: tab.value,
            label: tab.label,
            check: 'radio',
            checked: tab.value === value,
            disabled: tab.disabled,
            title: tab.title,
            onSelect: () => onChange(tab.value),
          }))}
        />
      ) : null}
    </>
  );
}

/**
 * The tabs of a panel header. Left and Right select a tab at once, and Tab
 * stops only on the selected tab.
 */
export function PanelTabs<T extends string>({
  tabs,
  value,
  onChange,
  more,
}: PanelTabsProps<T>): JSX.Element {
  const roving = useRovingSelection({
    items: tabs,
    value,
    onChange,
    disabled: false,
  });
  const select = (tab: PanelTab<T>): void => {
    if (tab.disabled === true || tab.value === value) return;
    onChange(tab.value);
  };
  return (
    <>
      <div role="tablist" className={styles.tabs}>
        {tabs.map((tab, index) => (
          <PanelTabButton
            key={tab.value}
            tab={tab}
            selected={tab.value === value}
            tabIndex={roving.tabIndexOf(index)}
            elementRef={roving.refOf(index)}
            onSelect={() => select(tab)}
            onKeyDown={event => roving.onKeyDown(index, event)}
          />
        ))}
      </div>
      {more === undefined || more.tabs.length === 0 ? null : (
        <PanelMoreTabs more={more} value={value} onChange={onChange} />
      )}
    </>
  );
}

/** A count or position after a tab or title, such as 128 or 2 / 9. */
export function PanelMeta({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <span className={styles.meta}>{children}</span>;
}

/** A song title with its position or count, such as 만복의 근원 하나님 2 / 9. */
export function PanelTitle({
  title,
  meta,
}: {
  readonly title: string;
  readonly meta?: string | undefined;
}): JSX.Element {
  return (
    <div className={styles.title}>
      <TruncatedText text={title} className={styles.titleText} />
      {meta === undefined ? null : <PanelMeta>{meta}</PanelMeta>}
    </div>
  );
}

export interface PanelSwitchProps {
  /** The current service name. */
  readonly value: string;
  /** Whether the service list is open. */
  readonly expanded: boolean;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly disabled?: boolean | undefined;
  readonly title?: string | undefined;
}

/**
 * The service switcher after the 예배 순서 tab: a click, Enter, Space, or
 * the down arrow opens the service list below it.
 */
export function PanelSwitch({
  value,
  expanded,
  onExpandedChange,
  disabled = false,
  title,
}: PanelSwitchProps): JSX.Element {
  const {targetProps, tooltip} = useTooltip(titleTooltip(title));
  const menuProps = menuButtonProps({expanded, onExpandedChange, disabled});
  const {onBlur: pressBlur, ...press} = useButtonPress({
    disabled,
    onPress: menuProps.onClick,
    onKeyDown: menuProps.onKeyDown,
  });
  return (
    <>
      <button
        {...withTooltipProps({onBlur: pressBlur}, targetProps)}
        {...menuProps}
        {...press}
        type="button"
        aria-disabled={disabled ? true : undefined}
        className={styles.switch}
      >
        {value}
        <Icon name="down" size={SWITCH_CHEVRON_SIZE} />
      </button>
      {tooltip}
    </>
  );
}

/** The sm controls at the right end of the header. */
export function PanelActions({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className={styles.actions}>{children}</div>;
}

/** The row under the header with one search or Bible verse field. */
export function PanelTools({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return <div className={styles.tools}>{children}</div>;
}

/** A body with 14px padding, a list body, or a body with no padding. */
export type PanelBodyVariant = 'padded' | 'list' | 'flush';

const bodyClass = {
  padded: undefined,
  list: styles.list,
  flush: styles.flush,
} as const satisfies Record<PanelBodyVariant, string | undefined>;

/** The scrolling body. With `tab`, it is the tab panel of that tab. */
export function PanelBody({
  variant = 'padded',
  tab,
  className,
  children,
}: {
  readonly variant?: PanelBodyVariant | undefined;
  /** The value of the selected tab that this body shows. */
  readonly tab?: string | undefined;
  readonly className?: string | undefined;
  readonly children: ReactNode;
}): JSX.Element {
  const base = useContext(PanelIdBase);
  return (
    <div
      role={tab === undefined ? undefined : 'tabpanel'}
      aria-labelledby={tab === undefined ? undefined : tabId(base, tab)}
      className={classNames(styles.body, bodyClass[variant], className)}
    >
      {children}
    </div>
  );
}

/** The 32px footer row: counts on the left, controls such as a slider at the end. */
export function PanelFooter({
  end,
  children,
}: {
  readonly end?: ReactNode;
  readonly children?: ReactNode;
}): JSX.Element {
  return (
    <div className={styles.footer}>
      {children}
      {end === undefined ? null : <div className={styles.footerEnd}>{end}</div>}
    </div>
  );
}
