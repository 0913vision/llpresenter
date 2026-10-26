import {useState, type JSX} from 'react';
import type {WindowAction} from '@shared/ipc';
import {sendLive, useOutputs} from '@renderer/state/live';
import {Icon, Menu, useTooltip} from '@renderer/ui';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {defaultScreens} from './screens';
import styles from './MenuBar.module.css';

// TODO(0913vision): Open the other menus, and add the Looks to 출력 (spec 01).
const inertMenus = ['파일', '편집', '보기'] as const;
const trailingMenus = ['창', '도움말'] as const;
const OUTPUT_MENU = '출력';

/** A screen whose warning still holds, for the 출력 menu. */
export interface WarningScreen {
  readonly screenId: string;
  /** The full screen name, such as 무대 화면. */
  readonly screenName: string;
}

interface WindowControl {
  readonly action: WindowAction;
  readonly icon: string;
  readonly label: string;
}

const windowControls: readonly WindowControl[] = [
  {action: 'minimize', icon: 'min', label: '최소화'},
  {action: 'toggle-maximize', icon: 'max', label: '최대화'},
  {action: 'close', icon: 'x', label: '닫기'},
];

function WindowButton({
  control,
}: {
  readonly control: WindowControl;
}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({text: control.label});
  return (
    <>
      <button
        {...targetProps}
        type="button"
        className={styles.control}
        aria-label={control.label}
        onClick={() => window.llp?.window.control(control.action)}
      >
        <Icon name={control.icon} size={14} />
      </button>
      {tooltip}
    </>
  );
}

function InertMenu({label}: {readonly label: string}): JSX.Element {
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={false}
      className={styles.menu}
    >
      {label}
    </button>
  );
}

function outputEntries({
  outputs,
  warnings,
  onShowWarning,
}: {
  readonly outputs: Readonly<Record<string, boolean>>;
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (screenId: string) => void;
}): readonly MenuEntry[] {
  const toggles: MenuEntry[] = defaultScreens.map(screen => {
    const on = outputs[screen.id] === true;
    return {
      kind: 'item',
      id: `output:${screen.id}`,
      label: screen.statusLabel,
      check: 'checkbox',
      checked: on,
      onSelect: () =>
        sendLive({type: 'output.set', screenId: screen.id, on: !on}),
    };
  });
  if (warnings.length === 0) return toggles;
  return [
    ...toggles,
    {kind: 'separator', id: 'warnings'},
    ...warnings.map(({screenId, screenName}): MenuEntry => ({
      kind: 'item',
      id: `warning:${screenId}`,
      label: `${screenName} 경고 보기`,
      onSelect: () => onShowWarning(screenId),
    })),
  ];
}

// NOTE(0913vision): The 출력 menu holds each screen's output on or off and,
// while a screen's warning holds, an item that shows its card again (spec
// 08). The other menus don't open yet.
function OutputMenu({
  warnings,
  onShowWarning,
}: {
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (screenId: string) => void;
}): JSX.Element {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const outputs = useOutputs();
  const expanded = anchor !== null;
  const setExpanded = (next: boolean, button: HTMLButtonElement): void => {
    setAnchor(next ? button : null);
  };
  return (
    <>
      <button
        type="button"
        role="menuitem"
        aria-haspopup="menu"
        aria-expanded={expanded}
        className={styles.menu}
        onClick={event => setExpanded(!expanded, event.currentTarget)}
        onKeyDown={event =>
          openOnArrowDown(event, {
            expanded,
            onExpandedChange: next => setExpanded(next, event.currentTarget),
          })
        }
      >
        {OUTPUT_MENU}
      </button>
      {anchor ? (
        <Menu
          label={OUTPUT_MENU}
          anchor={{kind: 'element', element: anchor}}
          onClose={() => setAnchor(null)}
          entries={outputEntries({outputs, warnings, onShowWarning})}
        />
      ) : null}
    </>
  );
}

const noWarnings: readonly WarningScreen[] = [];
const ignoreWarning = (): void => undefined;

/**
 * The 30px menu bar, which doubles as the window title bar. The center shows
 * the name of the open service.
 */
export function MenuBar({
  title,
  warnings = noWarnings,
  onShowWarning = ignoreWarning,
}: {
  readonly title: string;
  /** The screens whose warning still holds, for the 출력 menu. */
  readonly warnings?: readonly WarningScreen[] | undefined;
  readonly onShowWarning?: ((screenId: string) => void) | undefined;
}): JSX.Element {
  return (
    <div className={styles.bar}>
      <span className={styles.wordmark}>LoveLight</span>
      <div role="menubar" aria-label="메뉴" className={styles.menus}>
        {inertMenus.map(menu => (
          <InertMenu key={menu} label={menu} />
        ))}
        <OutputMenu warnings={warnings} onShowWarning={onShowWarning} />
        {trailingMenus.map(menu => (
          <InertMenu key={menu} label={menu} />
        ))}
      </div>
      <span className={styles.title}>{title}</span>
      <div className={styles.controls}>
        {windowControls.map(control => (
          <WindowButton key={control.action} control={control} />
        ))}
      </div>
    </div>
  );
}
