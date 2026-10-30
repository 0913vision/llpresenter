import {useState, type JSX} from 'react';
import type {WindowAction} from '@contracts/ipc/api';
import type {TextImportReadRequest} from '@core/schema/textImport';
import {useServiceActions} from '@renderer/prep/services/useServiceActions';
import {Icon, Menu, useTooltip} from '@renderer/ui';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useButtonPress} from '@renderer/ui/press';
import type {Notice} from '@renderer/ui/notices';
import {OutputMenuList} from './OutputMenuList';
import {fileMenuEntries} from './fileMenuEntries';
import {useFileMediaImport} from './useFileMediaImport';
import styles from './MenuBar.module.css';
import {useClipboardAvailability} from './useClipboardAvailability';
import {workspaceMenu} from './workspaceCommands';
import type {Workspace} from './Toolbar';

const inertMenus = ['편집'] as const;
const trailingMenus = ['창', '도움말'] as const;
const OUTPUT_MENU = '출력';
const FILE_MENU = '파일';
const VIEW_MENU = '보기';

type ImportText = (source: TextImportReadRequest['source']) => void;
type MenuName = typeof FILE_MENU | typeof OUTPUT_MENU | typeof VIEW_MENU;

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
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: () => window.llp?.window.control(control.action),
    onBlur: targetProps.onBlur,
  });
  return (
    <>
      <button
        {...targetProps}
        {...press}
        type="button"
        className={styles.control}
        aria-label={control.label}
      >
        <Icon name={control.icon} size={14} />
      </button>
      {tooltip}
    </>
  );
}

function InertMenu({label}: {readonly label: string}): JSX.Element {
  const {targetProps, tooltip} = useTooltip({
    text: `${label} 메뉴를 아직 지원하지 않습니다`,
  });
  return (
    <>
      <button
        {...targetProps}
        type="button"
        role="menuitem"
        aria-disabled="true"
        className={styles.menu}
      >
        {label}
      </button>
      {tooltip}
    </>
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
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: event => control.toggle(event.currentTarget),
    onKeyDown: event =>
      openOnArrowDown(event, {
        expanded,
        onExpandedChange: next => {
          if (next) control.open(event.currentTarget);
          else control.close();
        },
      }),
  });
  return (
    <button
      {...press}
      type="button"
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={styles.menu}
      onPointerEnter={event => control.hover(event.currentTarget)}
    >
      {label}
    </button>
  );
}

function FileMenu({
  onProblem,
  onImportText,
  control,
  clipboard,
}: {
  readonly onProblem: (notice: Notice) => void;
  readonly onImportText: ImportText | undefined;
  readonly control: MenuControl;
  readonly clipboard: ReturnType<typeof useClipboardAvailability>['status'];
}): JSX.Element {
  const {anchor} = control;
  const actions = useServiceActions({onProblem, onOpen: control.close});
  const media = useFileMediaImport(onProblem);
  return (
    <>
      <MenuTrigger label={FILE_MENU} control={control} />
      {anchor ? (
        <Menu
          label={FILE_MENU}
          anchor={{kind: 'element', element: anchor}}
          onClose={control.close}
          entries={fileMenuEntries({
            service: actions.entries,
            onImportText,
            clipboard,
            media,
          })}
        />
      ) : null}
      {actions.dialogs}
    </>
  );
}

function ViewMenu({
  control,
  entries,
}: {
  readonly control: MenuControl;
  readonly entries: readonly MenuEntry[];
}): JSX.Element {
  return (
    <>
      <MenuTrigger label={VIEW_MENU} control={control} />
      {control.anchor === null ? null : (
        <Menu
          label={VIEW_MENU}
          anchor={{kind: 'element', element: control.anchor}}
          entries={entries}
          onClose={control.close}
        />
      )}
    </>
  );
}

function OutputMenu({
  warnings,
  onShowWarning,
  control,
  onProblem,
  onWorkspace,
}: {
  readonly warnings: readonly WarningScreen[];
  readonly onShowWarning: (screenId: string) => void;
  readonly control: MenuControl;
  readonly onProblem: (notice: Notice) => void;
  readonly onWorkspace: ((workspace: Workspace) => void) | undefined;
}): JSX.Element {
  return (
    <>
      <MenuTrigger label={OUTPUT_MENU} control={control} />
      {control.anchor ? (
        <OutputMenuList
          anchor={control.anchor}
          onClose={control.close}
          warnings={warnings}
          onShowWarning={onShowWarning}
          onProblem={onProblem}
          onWorkspace={onWorkspace}
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
  clipboardAvailable,
  onWorkspace,
  onMedia,
}: {
  readonly title: string;
  /** The screens whose warning still holds, for the 출력 menu. */
  readonly warnings?: readonly WarningScreen[] | undefined;
  readonly onShowWarning?: ((screenId: string) => void) | undefined;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  /** Mounts P5's file and clipboard entry flow when its host is available. */
  readonly onImportText?: ImportText | undefined;
  readonly clipboardAvailable?: (() => Promise<boolean>) | undefined;
  readonly onWorkspace?: ((workspace: Workspace) => void) | undefined;
  readonly onMedia?: (() => void) | undefined;
}): JSX.Element {
  const [active, setActive] = useState<ActiveMenu | null>(null);
  const {status: clipboard, check: checkClipboard} =
    useClipboardAvailability(clipboardAvailable);
  const controlFor = (name: MenuName): MenuControl => ({
    anchor: active?.name === name ? active.anchor : null,
    open: anchor => {
      if (name === FILE_MENU) checkClipboard();
      setActive({name, anchor, openedByHover: false});
    },
    toggle: anchor => {
      if (name === FILE_MENU && active?.name !== FILE_MENU) checkClipboard();
      setActive(current =>
        current?.name === name && !current.openedByHover
          ? null
          : {name, anchor, openedByHover: false},
      );
    },
    hover: anchor => {
      if (name === FILE_MENU && active !== null && active.name !== FILE_MENU) {
        checkClipboard();
      }
      setActive(current =>
        current !== null && current.name !== name
          ? {name, anchor, openedByHover: true}
          : current,
      );
    },
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
          clipboard={clipboard}
          control={controlFor(FILE_MENU)}
        />
        {inertMenus.map(menu => (
          <InertMenu key={menu} label={menu} />
        ))}
        <ViewMenu
          control={controlFor(VIEW_MENU)}
          entries={workspaceMenu({onWorkspace, onMedia})}
        />
        <OutputMenu
          warnings={warnings}
          onShowWarning={onShowWarning}
          control={controlFor(OUTPUT_MENU)}
          onProblem={onProblem}
          onWorkspace={onWorkspace}
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
