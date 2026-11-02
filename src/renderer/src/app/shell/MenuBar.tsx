import {useWindowShortcuts} from '@renderer/platform/windowShortcuts';
import {useMenuShortcuts} from '@renderer/ui/useMenuShortcuts';
import {useState, type JSX} from 'react';
import type {WindowAction} from '@contracts/ipc/api';
import type {AppInfo} from '@contracts/ipc/window';
import {AlertDialog} from '@renderer/ui/AlertDialog';
import type {TextImportReadRequest} from '@core/schema/textImport';
import {useServiceActions} from '@renderer/features/service/list/useServiceActions';
import {Icon, Menu, useTooltip} from '@renderer/ui';
import type {MenuEntry} from '@renderer/ui/menuModel';
import {openOnArrowDown} from '@renderer/ui/menuButton';
import {useButtonPress} from '@renderer/ui/press';
import type {Notice} from '@renderer/ui/notices';
import {OutputMenuList} from './OutputMenuList';
import {editMenuEntries} from './editMenuEntries';
import {fileMenuEntries} from './fileMenuEntries';
import {useOutsideFocus} from './outsideFocus';
import {helpMenuEntries, windowMenuEntries} from './windowMenuEntries';
import {useFileMediaImport} from './useFileMediaImport';
import styles from './MenuBar.module.css';
import {useClipboardAvailability} from './useClipboardAvailability';
import {workspaceMenu} from './workspaceCommands';
import type {Workspace} from './Toolbar';

const EDIT_MENU = '편집';
const WINDOW_MENU = '창';
const HELP_MENU = '도움말';
const OUTPUT_MENU = '출력';
const FILE_MENU = '파일';
const VIEW_MENU = '보기';

type ImportText = (source: TextImportReadRequest['source']) => void;
type MenuName =
  | typeof FILE_MENU
  | typeof EDIT_MENU
  | typeof VIEW_MENU
  | typeof OUTPUT_MENU
  | typeof WINDOW_MENU
  | typeof HELP_MENU;

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
  const command =
    control.action === 'minimize'
      ? 'window.minimize'
      : control.action === 'toggle-maximize'
        ? 'window.maximize'
        : 'app.quit';
  const run = (): void => window.llp?.window.control(control.action);
  useWindowShortcuts([{id: command, run}]);
  const {targetProps, tooltip} = useTooltip({text: control.label, command});
  const press = useButtonPress<HTMLButtonElement>({
    disabled: false,
    onPress: run,
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
  const entries = fileMenuEntries({
    service: actions.entries,
    onImportText,
    clipboard,
    media,
  });
  useMenuShortcuts(entries);
  return (
    <>
      <MenuTrigger label={FILE_MENU} control={control} />
      {anchor ? (
        <Menu
          label={FILE_MENU}
          anchor={{kind: 'element', element: anchor}}
          onClose={control.close}
          entries={entries}
        />
      ) : null}
      {actions.dialogs}
    </>
  );
}

function EntryMenu({
  label,
  control,
  entries,
}: {
  readonly label: MenuName;
  readonly control: MenuControl;
  readonly entries: () => readonly MenuEntry[];
}): JSX.Element {
  return (
    <>
      <MenuTrigger label={label} control={control} />
      {control.anchor === null ? null : (
        <Menu
          label={label}
          anchor={{kind: 'element', element: control.anchor}}
          entries={entries()}
          onClose={control.close}
        />
      )}
    </>
  );
}

/** The 도움말 menu and the dialog its 버전 정보 row opens. */
function HelpMenu({control}: {readonly control: MenuControl}): JSX.Element {
  const [about, setAbout] = useState<AppInfo | null>(null);
  const showAbout = (): void => {
    window.llp?.window.appInfo().then(setAbout, (error: unknown) =>
      window.llp?.log.write({
        level: 'error',
        message: 'Could not read the app version',
        detail: error instanceof Error ? error.message : String(error),
      }),
    );
  };
  return (
    <>
      <EntryMenu
        label={HELP_MENU}
        control={control}
        entries={() => helpMenuEntries({showAbout})}
      />
      {about === null ? null : (
        <AlertDialog
          icon="info"
          title="버전 정보"
          meta={[`${about.name} ${about.version}`]}
          actions={[
            {
              label: '확인',
              primary: true,
              escape: true,
              onSelect: () => setAbout(null),
            },
          ]}
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
      <OutputMenuList
        anchor={control.anchor}
        onClose={control.close}
        warnings={warnings}
        onShowWarning={onShowWarning}
        onProblem={onProblem}
        onWorkspace={onWorkspace}
      />
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
  const outsideFocus = useOutsideFocus();
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
        <EntryMenu
          label={EDIT_MENU}
          control={controlFor(EDIT_MENU)}
          entries={() => editMenuEntries(outsideFocus())}
        />
        <EntryMenu
          label={VIEW_MENU}
          control={controlFor(VIEW_MENU)}
          entries={() => workspaceMenu({onWorkspace, onMedia})}
        />
        <OutputMenu
          warnings={warnings}
          onShowWarning={onShowWarning}
          control={controlFor(OUTPUT_MENU)}
          onProblem={onProblem}
          onWorkspace={onWorkspace}
        />
        <EntryMenu
          label={WINDOW_MENU}
          control={controlFor(WINDOW_MENU)}
          entries={windowMenuEntries}
        />
        <HelpMenu control={controlFor(HELP_MENU)} />
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
