import {CommandScope} from '@renderer/ui/keys/commandDispatcher';
import type {SongId} from '@core/schema/common/ids';
import {Suspense, useEffect, useState, type JSX, type ReactNode} from 'react';
import {MediaBin} from '@renderer/features/media/MediaBin';
import type {MediaApi} from '@renderer/features/media/mediaLibrary';
import {
  MediaViewProvider,
  useHasMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/popups/notices';
import {
  useLibraryPanels,
  usePrepPanels,
  type PrepBinding,
} from '../../workspaces/prepPanels';
import {useUndoReveal} from './useUndoReveal';
import type {ThemeLeaveGuard} from '@renderer/features/screens/themes/saving/themeLeaveGuard';
import {useScreensPanels} from '../../workspaces/screensPanels';
import {ShowShortcuts, useShowPanels} from '../../workspaces/showPanels';
import {ColumnGap} from '../columns/ColumnGap';
import {SidebarCollapseButton, useSidebarToggle} from './SidebarToggle';
import type {ColumnWidthStore} from '../columns/columnWidthStore';
import {useColumnLayout} from '../columns/useColumnLayout';
import type {SidebarCollapse} from './useSidebarCollapse';
import {logPanelProblem, type WorkspacePanels} from './WorkspacePanel';
import {WorkspaceColumns} from './WorkspaceColumns';
import {ResizeGap} from '@renderer/ui/panels/ResizeGap';
import {useRowLayout} from '@renderer/ui/panels/useRowLayout';
import styles from './Workspace.module.css';
import {
  ShowSlideEntry,
  useShowPanelNavigation,
} from '@renderer/features/presentation/keyboard/showPanelNavigation';
import type {PrepTarget} from '@renderer/session/prepTarget';
import {ShownItemProvider} from '@renderer/session/show/shownItem';
import {undoTimeline} from '@renderer/platform/undo/undoTimeline';
import {NO_UNDO_IN_SHOW} from '@renderer/platform/problemReasons';
import {useWorkspaceServiceHistory} from './useWorkspaceServiceHistory';
import type {Workspace as WorkspaceId} from '@renderer/platform/WorkspaceNavigation';
import type {SizeClass} from '@core/schema/app/appConfig';

/**
 * 실행 취소 follows the workspace on screen: it is off in 진행, which sends
 * what is on the screens, so a step run back there would change them behind
 * the operator; and each tab runs back only its own steps (USER Nov 25).
 */
function useWorkspaceUndo(visible: WorkspaceId): void {
  const showVisible = visible === 'show';
  useEffect(() => {
    undoTimeline.block(showVisible ? NO_UNDO_IN_SHOW : undefined);
  }, [showVisible]);
  useEffect(() => {
    undoTimeline.showTab(visible);
  }, [visible]);
}

/**
 * A workspace's frame that stays built while another workspace shows: hidden,
 * out of the focus order, and with its commands' keys off, so going back
 * shows it in the next frame instead of building it again. Every workspace
 * has one, built once: a switch never builds a view again nor shows another
 * one on the way (USER Nov 21, Nov 27).
 */
function KeptFrame({
  workspace,
  visible,
  children,
}: {
  readonly workspace: WorkspaceId;
  readonly visible: boolean;
  readonly children: ReactNode;
}): JSX.Element {
  // NOTE(0913vision): A hidden frame keeps the content it last showed, the
  // same elements, so React leaves it alone on a switch and only the frame
  // coming up is drawn again; what its parts follow on their own still
  // reaches them.
  const [kept, setKept] = useState(children);
  if (visible && kept !== children) setKept(children);
  return (
    <div
      className={classNames(styles.frameSlot, !visible && styles.hiddenFrame)}
      data-workspace-frame={workspace}
      inert={!visible}
      aria-hidden={!visible}
    >
      <CommandScope value={visible ? 'visible' : 'hidden'}>
        {visible ? children : kept}
      </CommandScope>
    </div>
  );
}

/**
 * The three-column frame shared by all workspaces. Each workspace's panels
 * come from its own file in `app/workspaces/`; the frame keeps every
 * workspace built while another one shows.
 */
export function Workspace({
  id,
  prepItemId,
  sizeClass,
  store,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
  prep,
  prepTarget = null,
  warningHeight = 0,
  mediaVisible = true,
  onMediaOpenChange,
  mediaApi,
  sidebar,
  themeLeave,
}: {
  readonly id: WorkspaceId;
  readonly prepItemId?: string | null | undefined;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onShowInLibrary?: ((songId: SongId) => void) | undefined;
  readonly prep?: PrepBinding | undefined;
  readonly prepTarget?: PrepTarget | null | undefined;
  readonly warningHeight?: number;
  readonly mediaVisible?: boolean | undefined;
  readonly onMediaOpenChange?: ((open: boolean) => void) | undefined;
  readonly mediaApi?: MediaApi | undefined;
  readonly sidebar?: SidebarCollapse | undefined;
  readonly themeLeave?: ThemeLeaveGuard | undefined;
}): JSX.Element {
  // NOTE(0913vision): 라이브러리 lays out as 준비 does: the same column widths,
  // the same keys and the same media bin.
  const layoutOf = (workspace: WorkspaceId): WorkspaceId =>
    workspace === 'library' ? 'prep' : workspace;
  const right = layoutOf(id) === 'prep' ? 'prepRight' : 'right';
  const problem = onProblem ?? logPanelProblem;
  const toggle = useSidebarToggle(sidebar);
  const {gridRef, drag} = useColumnLayout({
    sizeClass,
    store,
    right,
    leftCollapsed: toggle.collapsed,
  });
  const screens = useScreensPanels({
    active: true,
    onProblem,
    leaveGuard: themeLeave,
  });
  const [lastVisible, setLastVisible] = useState<WorkspaceId>('show');
  const visibleId = id === 'screens' && !screens.ready ? lastVisible : id;
  if (visibleId !== lastVisible) setLastVisible(visibleId);
  const showVisible = visibleId === 'show';
  useWorkspaceServiceHistory(visibleId !== 'screens', problem);
  useUndoReveal(onShowInLibrary);
  useWorkspaceUndo(visibleId);
  // NOTE(0913vision): 진행 stays built, hidden, while another workspace
  // shows, so going back to 진행 shows its panels in the next frame instead of
  // building them again.
  const navigation = useShowPanelNavigation(gridRef, showVisible);
  const show = useShowPanels({
    active: true,
    sizeClass,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
    sidebarAction: toggle.collapsible ? (
      <SidebarCollapseButton
        claimFocus={toggle.claimFocus}
        onPress={(button, keyboard) => toggle.toggle(true, button, keyboard)}
      />
    ) : null,
  });
  const prepPanels = usePrepPanels({
    prep,
    target: prepTarget,
    selectedItem: prepItemId,
    sizeClass,
    onProblem,
    onOpenPrep,
    onShowInLibrary,
  });
  const libraryPanels = useLibraryPanels({prep, onProblem});
  const hasMediaView = useHasMediaView();
  const api = mediaApi ?? prep?.api ?? window.llp;
  const mediaShown = visibleId !== 'screens' && api !== undefined;
  const mediaOpen = mediaShown && mediaVisible;
  const mediaRows = useRowLayout({
    container: gridRef,
    store,
    sizeClass,
    layoutKey: 'media',
    enabled: mediaOpen,
    fill: 'first',
  });
  // NOTE(0913vision): null is 준비 showing no item, apart from undefined,
  // which leaves the item the app opened.
  const prepShown =
    prepPanels.shownItem === undefined ? prepItemId : prepPanels.shownItem;
  const columnFrame = (
    workspace: WorkspaceId,
    panels: WorkspacePanels,
    {collapsed = false, visible = true} = {},
  ): JSX.Element => (
    <WorkspaceColumns
      workspace={workspace}
      panels={panels}
      collapsed={collapsed}
      visible={visible}
      sizeClass={sizeClass}
      store={store}
      drag={drag}
      toggle={toggle}
      warningHeight={warningHeight}
    />
  );
  const frame = (
    <main
      ref={gridRef}
      data-workspace-layout={layoutOf(visibleId)}
      onKeyDown={navigation.onKeyDown}
      className={classNames(
        styles.workspace,
        mediaShown && styles.mediaAvailable,
        mediaOpen && styles.mediaOpen,
      )}
    >
      {showVisible ? <ShowShortcuts onProblem={problem} /> : null}
      <div data-resize-panel="media.upper" className={styles.frames}>
        <KeptFrame workspace="show" visible={showVisible}>
          <Suspense fallback={null}>
            {columnFrame('show', show, {
              collapsed: toggle.collapsed,
              visible: showVisible,
            })}
          </Suspense>
        </KeptFrame>
        <KeptFrame workspace="prep" visible={visibleId === 'prep'}>
          <ShownItemProvider shownItem={prepShown}>
            {columnFrame('prep', prepPanels, {visible: visibleId === 'prep'})}
          </ShownItemProvider>
        </KeptFrame>
        <KeptFrame workspace="library" visible={visibleId === 'library'}>
          {columnFrame('prep', libraryPanels, {
            visible: visibleId === 'library',
          })}
        </KeptFrame>
        <KeptFrame workspace="screens" visible={visibleId === 'screens'}>
          {columnFrame('screens', screens, {visible: visibleId === 'screens'})}
        </KeptFrame>
      </div>
      {mediaOpen ? (
        <ResizeGap
          axis="row"
          name="media.bin"
          begin={() => mediaRows.begin(0)}
          disabled={!mediaRows.canResize(0)}
        />
      ) : null}
      {mediaShown ? (
        <MediaBin
          workspace={layoutOf(visibleId) === 'prep' ? 'prep' : 'show'}
          open={mediaOpen}
          onOpenChange={onMediaOpenChange}
          onProblem={problem}
          rowStore={store}
          sizeClass={sizeClass}
          columnGap={column => (
            <ColumnGap
              column={column === 'right' ? right : column}
              drag={drag}
            />
          )}
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
        active={visibleId !== 'screens'}
        onProblem={problem}
      >
        {frame}
      </MediaViewProvider>
    );
  return (
    <ShowSlideEntry value={navigation.slideEntry}>{content}</ShowSlideEntry>
  );
}
