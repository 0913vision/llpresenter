import {useState, type JSX} from 'react';
import type {WindowAction} from '@shared/ipc';
import type {TextImportReadRequest} from '@shared/schema/textImport';
import {useServiceActions} from '@renderer/prep/services/useServiceActions';
import {sendLive, useOutputs} from '@renderer/state/live';
import {Icon, Menu, useTooltip} from '@renderer/ui';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import type {Notice} from '@renderer/ui/notices';
import {defaultScreens} from './screens';
import styles from './MenuBar.module.css';

// TODO(0913vision): Open the other menus, and add the Looks to 출력 (spec 01).
const inertMenus = ['편집', '보기'] as const;
const trailingMenus = ['창', '도움말'] as const;
const OUTPUT_MENU = '출력';
const FILE_MENU = '파일';
const IMPORT_UNAVAILABLE = '텍스트 가져오기를 준비 중입니다';

type ImportText = (source: TextImportReadRequest['source']) => void;
type MenuName = typeof FILE_MENU | typeof OUTPUT_MENU;

interface ActiveMenu {
  readonly name: MenuName;
  readonly anchor: HTMLButtonElement;
  readonly openedByHover: boolean;
}

interface MenuControl {
  readonly anchor: HTMLButtonElement | null;
  readonly open: (anchor: HTMLButtonElement) => void;
  readonly toggle: (anchor: HTMLButtonElement) => void;
  readonly hover: (anchor: HTMLButtonElement) => void;
  readonly close: () => void;
}

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

function MenuTrigger({
  label,
  control,
}: {
  readonly label: string;
  readonly control: MenuControl;
}): JSX.Element {
  const expanded = control.anchor !== null;
  return (
    <button
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={styles.menu}
      onClick={event => control.toggle(event.currentTarget)}
      onPointerEnter={event => control.hover(event.currentTarget)}
      onKeyDown={event =>
        openOnArrowDown(event, {
          expanded,
          onExpandedChange: next => {
            if (next) control.open(event.currentTarget);
            else control.close();
          },
        })
      }
    >
      {label}
    </button>
  );
}

function FileMenu({
  onProblem,
  onImportText,
  control,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onImportText: ImportText | undefined;
  readonly control: MenuControl;
}): JSX.Element {
  const {anchor} = control;
  const actions = useServiceActions({onProblem, onOpen: control.close});
  const imports: readonly MenuEntry[] = [
    ...(['file', 'clipboard'] as const).map(source => ({
      kind: 'item' as const,
      id: `import:${source}`,
      label: source === 'file' ? '텍스트 파일' : '클립보드 텍스트',
      icon: source === 'file' ? 'filetext' : 'copy',
      disabled: onImportText === undefined,
      title: onImportText === undefined ? IMPORT_UNAVAILABLE : undefined,
      onSelect: () => onImportText?.(source),
    })),
    {
      kind: 'item',
      id: 'import:powerpoint',
      label: 'PowerPoint 파일',
      disabled: true,
      title: 'PowerPoint 가져오기는 이후 버전에서 지원합니다',
    },
  ];
  return (
    <>
      <MenuTrigger label={FILE_MENU} control={control} />
      {anchor ? (
        <Menu
          label={FILE_MENU}
          anchor={{kind: 'element', element: anchor}}
          onClose={control.close}
          entries={[
            ...actions.entries,
            {kind: 'separator', id: 'imports'},
            {kind: 'item', id: 'import', label: '가져오기', submenu: imports},
          ]}
        />
      ) : null}
      {actions.dialogs}
    </>
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
// 08).
function OutputMenu({
  warnings,
  onShowWarning,
  control,
}: {
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (screenId: string) => void;
  readonly control: MenuControl;
}): JSX.Element {
  const {anchor} = control;
  const outputs = useOutputs();
  return (
    <>
      <MenuTrigger label={OUTPUT_MENU} control={control} />
      {anchor ? (
        <Menu
          label={OUTPUT_MENU}
          anchor={{kind: 'element', element: anchor}}
          onClose={control.close}
          entries={outputEntries({outputs, warnings, onShowWarning})}
        />
      ) : null}
    </>
  );
}

const noWarnings: readonly WarningScreen[] = [];
const ignoreWarning = (): void => undefined;

function logProblem(notice: Notice): void {
  console.error('Menu bar action failed:', notice.key);
}

/**
 * The 30px menu bar, which doubles as the window title bar. The center shows
 * the name of the open service.
 */
export function MenuBar({
  title,
  warnings = noWarnings,
  onShowWarning = ignoreWarning,
  onProblem = logProblem,
  onImportText,
}: {
  readonly title: string;
  /** The screens whose warning still holds, for the 출력 menu. */
  readonly warnings?: readonly WarningScreen[] | undefined;
  readonly onShowWarning?: ((screenId: string) => void) | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  /** Mounts P5's file and clipboard entry flow when its host is available. */
  readonly onImportText?: ImportText | undefined;
}): JSX.Element {
  const [active, setActive] = useState<ActiveMenu | null>(null);
  const controlFor = (name: MenuName): MenuControl => ({
    anchor: active?.name === name ? active.anchor : null,
    open: anchor => setActive({name, anchor, openedByHover: false}),
    toggle: anchor =>
      setActive(current =>
        current?.name === name && !current.openedByHover
          ? null
          : {name, anchor, openedByHover: false},
      ),
    hover: anchor =>
      setActive(current =>
        current !== null && current.name !== name
          ? {name, anchor, openedByHover: true}
          : current,
      ),
    close: () =>
      setActive(current => (current?.name === name ? null : current)),
  });
  return (
    <div className={styles.bar}>
      <span className={styles.wordmark}>LoveLight</span>
      <div role="menubar" aria-label="메뉴" className={styles.menus}>
        <FileMenu
          onProblem={onProblem}
          onImportText={onImportText}
          control={controlFor(FILE_MENU)}
        />
        {inertMenus.map(menu => (
          <InertMenu key={menu} label={menu} />
        ))}
        <OutputMenu
          warnings={warnings}
          onShowWarning={onShowWarning}
          control={controlFor(OUTPUT_MENU)}
        />
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
