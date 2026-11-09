import type {SongId} from '@core/schema/ids';
import {Fragment, useCallback, useRef, type JSX} from 'react';
import {MediaBin} from '@renderer/features/media/MediaBin';
import type {MediaApi} from '@renderer/features/media/mediaLibrary';
import {
  MediaViewProvider,
  useHasMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/notices';
import {usePrepPanels, type PrepBinding} from '../workspaces/prepPanels';
import type {ThemeLeaveGuard} from '@renderer/features/screens/themes/themeLeaveGuard';
import {useScreensPanels} from '../workspaces/screensPanels';
import {ShowShortcuts, useShowPanels} from '../workspaces/showPanels';
import {ColumnGap} from './ColumnGap';
import {CollapsedSidebar, SidebarCollapseButton} from './SidebarToggle';
import type {ColumnWidthStore} from './columnWidthStore';
import type {SizeClass} from '../../ui/sizeClass';
import type {Workspace as WorkspaceId} from './Toolbar';
import {useColumnLayout} from './useColumnLayout';
import type {SidebarCollapse} from './useSidebarCollapse';
import {logPanelProblem} from './WorkspacePanel';
import {PanelColumn} from './PanelColumn';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import {useRowLayout} from '@renderer/ui/useRowLayout';
import styles from './Workspace.module.css';
import {
  ShowSlideEntry,
  useShowPanelNavigation,
} from '@renderer/features/presentation/showPanelNavigation';

const ignoreProblem = (): void => undefined;

// NOTE(0913vision): The button that replaces a pressed sidebar button takes
// the keyboard focus only when the pressed one had it (a key press, not a
// click in 진행); otherwise the focus falls to the body, where the 진행 keys
// work.
function useSidebarToggle(sidebar: SidebarCollapse | undefined) {
  const pendingFocus = useRef(false);
  const claimFocus = useCallback((): boolean => {
    const pending = pendingFocus.current;
    pendingFocus.current = false;
    return pending;
  }, []);
  const setCollapsed = sidebar?.setCollapsed;
  const toggle = (collapsed: boolean, button: HTMLButtonElement): void => {
    pendingFocus.current = document.activeElement === button;
    setCollapsed?.(collapsed);
  };
  return {
    claimFocus,
    collapsible: setCollapsed !== undefined,
    collapsed: setCollapsed !== undefined && sidebar?.collapsed === true,
    toggle,
  };
}

/**
 * The three-column frame shared by all workspaces. Each workspace's panels
 * come from its own file in `app/workspaces/`; the frame keeps every
 * workspace's state while another one shows.
 */
export function Workspace({
  id,
  sizeClass,
  store,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
  prep,
  warningHeight = 0,
  mediaVisible = true,
  onMediaOpenChange,
  mediaApi,
  sidebar,
  themeLeave,
}: {
  readonly id: WorkspaceId;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onShowInLibrary?: ((songId: SongId) => void) | undefined;
  readonly prep?: PrepBinding | undefined;
  readonly warningHeight?: number;
  readonly mediaVisible?: boolean | undefined;
  readonly onMediaOpenChange?: ((open: boolean) => void) | undefined;
  readonly mediaApi?: MediaApi | undefined;
  readonly sidebar?: SidebarCollapse | undefined;
  readonly themeLeave?: ThemeLeaveGuard | undefined;
}): JSX.Element {
  const {gridRef, drag} = useColumnLayout(sizeClass, store);
  const navigation = useShowPanelNavigation(gridRef, id === 'show');
  const toggle = useSidebarToggle(id === 'show' ? sidebar : undefined);
  const show = useShowPanels({
    active: id === 'show',
    sizeClass,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
    sidebarAction: toggle.collapsible ? (
      <SidebarCollapseButton
        claimFocus={toggle.claimFocus}
        onPress={button => toggle.toggle(true, button)}
      />
    ) : null,
  });
  const prepPanels = usePrepPanels({
    prep,
    sizeClass,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
  });
  const screens = useScreensPanels({
    active: id === 'screens',
    onProblem,
    leaveGuard: themeLeave,
  });
  const panels = id === 'show' ? show : id === 'prep' ? prepPanels : screens;
  const hasMediaView = useHasMediaView();
  const {columns} = panels;
  const api = mediaApi ?? prep?.api ?? window.llp;
  const mediaOpen = id !== 'screens' && mediaVisible;
  const mediaRows = useRowLayout({
    container: gridRef,
    store,
    sizeClass,
    layoutKey: 'media',
    enabled: mediaOpen && api !== undefined,
    fill: 'first',
  });
  const panelColumns = columns.map((titles, column) => (
    <Fragment key={column}>
      {column === 1 && toggle.collapsed ? <div aria-hidden="true" /> : null}
      {column > 0 && !(column === 1 && toggle.collapsed) ? (
        <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
      ) : null}
      {column === 0 && toggle.collapsed ? (
        <div className={styles.column} data-panel="예배 순서">
          <CollapsedSidebar
            claimFocus={toggle.claimFocus}
            onPress={button => toggle.toggle(false, button)}
          />
        </div>
      ) : (
        <PanelColumn
          workspace={id}
          titles={titles}
          partsOf={panels.partsOf}
          store={store}
          sizeClass={sizeClass}
          draft={columns[1]?.[0] === '편집'}
          warningHeight={column === columns.length - 1 ? warningHeight : 0}
        />
      )}
    </Fragment>
  ));
  // TODO(0913vision): Let the shrink rule ignore the hidden left width while
  // the left column is collapsed; it still counts the saved width now.
  const frame = (
    <main
      ref={gridRef}
      data-workspace-layout={id}
      onKeyDown={navigation.onKeyDown}
      className={classNames(
        styles.workspace,
        id !== 'screens' && api !== undefined && styles.mediaAvailable,
        mediaOpen && api !== undefined && styles.mediaOpen,
      )}
    >
      {id === 'show' ? (
        <ShowShortcuts onProblem={onProblem ?? logPanelProblem} />
      ) : null}
      <div
        data-resize-panel="media.upper"
        className={classNames(
          styles.columns,
          toggle.collapsed && styles.leftCollapsed,
          id === 'screens' && styles.screenSettings,
        )}
      >
        {panelColumns}
      </div>
      {mediaOpen && api !== undefined ? (
        <ResizeGap
          axis="row"
          name="media.bin"
          begin={() => mediaRows.begin(0)}
          disabled={!mediaRows.canResize(0)}
        />
      ) : null}
      {id !== 'screens' && api !== undefined ? (
        <MediaBin
          workspace={id}
          open={mediaOpen}
          onOpenChange={onMediaOpenChange}
          onProblem={onProblem ?? ignoreProblem}
          rowStore={store}
          sizeClass={sizeClass}
          columnGap={column => <ColumnGap column={column} drag={drag} />}
        />
      ) : null}
    </main>
  );
  const content =
    api === undefined || hasMediaView ? (
      frame
    ) : (
      <MediaViewProvider
        api={api}
        active={id !== 'screens'}
        onProblem={onProblem ?? ignoreProblem}
      >
        {frame}
      </MediaViewProvider>
    );
  return (
    <ShowSlideEntry value={navigation.slideEntry}>{content}</ShowSlideEntry>
  );
}
