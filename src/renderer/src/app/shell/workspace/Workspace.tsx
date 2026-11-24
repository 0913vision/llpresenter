import {CommandScope} from '@renderer/ui/keys/commandDispatcher';
import type {SongId} from '@core/schema/common/ids';
import {Suspense, useEffect, useState, type JSX} from 'react';
import {MediaBin} from '@renderer/features/media/MediaBin';
import type {MediaApi} from '@renderer/features/media/mediaLibrary';
import {
  MediaViewProvider,
  useHasMediaView,
} from '@renderer/features/media/MediaViewProvider';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/popups/notices';
import {usePrepPanels, type PrepBinding} from '../../workspaces/prepPanels';
import {useUndoReveal} from './useUndoReveal';
import type {ThemeLeaveGuard} from '@renderer/features/screens/themes/saving/themeLeaveGuard';
import {useScreensPanels} from '../../workspaces/screensPanels';
import {ShowShortcuts, useShowPanels} from '../../workspaces/showPanels';
import {ColumnGap} from '../columns/ColumnGap';
import {SidebarCollapseButton, useSidebarToggle} from './SidebarToggle';
import type {ColumnWidthStore} from '../columns/columnWidthStore';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import {useColumnLayout} from '../columns/useColumnLayout';
import type {SidebarCollapse} from './useSidebarCollapse';
import {logPanelProblem, type WorkspacePanels} from './WorkspacePanel';
import {WorkspaceColumns} from './WorkspaceColumns';
import {ResizeGap} from '@renderer/ui/panels/ResizeGap';
import {useRowLayout} from '@renderer/ui/lists/useRowLayout';
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

function ignoreProblem(): void {
  return undefined;
}

/**
 * The three-column frame shared by all workspaces. Each workspace's panels
 * come from its own file in `app/workspaces/`; the frame keeps every
 * workspace's state while another one shows.
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
  const right = id === 'prep' ? 'prepRight' : 'right';
  const {gridRef, drag} = useColumnLayout(sizeClass, store, right);
  const screens = useScreensPanels({
    active: id === 'screens',
    onProblem,
    leaveGuard: themeLeave,
  });
  const [lastVisible, setLastVisible] = useState<WorkspaceId>('show');
  const visibleId = id === 'screens' && !screens.ready ? lastVisible : id;
  if (visibleId !== lastVisible) setLastVisible(visibleId);
  const showVisible = visibleId === 'show';
  useWorkspaceServiceHistory(
    visibleId !== 'screens',
    onProblem ?? logPanelProblem,
  );
  useUndoReveal(onShowInLibrary);
  // NOTE(0913vision): 진행 sends what is on the screens, so 실행 취소 there
  // would change it behind the operator; edits are run back in 준비.
  useEffect(() => {
    undoTimeline.block(showVisible ? NO_UNDO_IN_SHOW : undefined);
  }, [showVisible]);
  // NOTE(0913vision): 진행 stays built, hidden, while another workspace
  // shows, so going back to 진행 shows its panels in the next frame instead of
  // building them again.
  const navigation = useShowPanelNavigation(gridRef, showVisible);
  const toggle = useSidebarToggle(sidebar);
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
  const hasMediaView = useHasMediaView();
  const api = mediaApi ?? prep?.api ?? window.llp;
  const mediaOpen = visibleId !== 'screens' && mediaVisible;
  const mediaRows = useRowLayout({
    container: gridRef,
    store,
    sizeClass,
    layoutKey: 'media',
    enabled: mediaOpen && api !== undefined,
    fill: 'first',
  });
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
  // TODO(0913vision): Let the shrink rule ignore the hidden left width while
  // the left column is collapsed; it still counts the saved width now.
  const frame = (
    <main
      ref={gridRef}
      data-workspace-layout={visibleId}
      onKeyDown={navigation.onKeyDown}
      className={classNames(
        styles.workspace,
        visibleId !== 'screens' && api !== undefined && styles.mediaAvailable,
        mediaOpen && api !== undefined && styles.mediaOpen,
      )}
    >
      {visibleId === 'show' ? (
        <ShowShortcuts onProblem={onProblem ?? logPanelProblem} />
      ) : null}
      <div data-resize-panel="media.upper" className={styles.frames}>
        <div
          className={classNames(
            styles.frameSlot,
            !showVisible && styles.hiddenFrame,
          )}
          data-workspace-frame="show"
          inert={!showVisible}
          aria-hidden={!showVisible}
        >
          <CommandScope value={showVisible ? 'visible' : 'hidden'}>
            <Suspense fallback={null}>
              {columnFrame('show', show, {
                collapsed: toggle.collapsed,
                visible: showVisible,
              })}
            </Suspense>
          </CommandScope>
        </div>
        <div
          className={classNames(
            styles.frameSlot,
            visibleId !== 'prep' && styles.hiddenFrame,
          )}
          data-workspace-frame="prep"
          data-prep-frame
          data-prep-item={prepPanels.shownItem ?? prepItemId ?? undefined}
          data-prep-editing={prepPanels.editing === true ? 'true' : 'false'}
          inert={visibleId !== 'prep'}
          aria-hidden={visibleId !== 'prep'}
        >
          <ShownItemProvider
            shownItem={
              prepPanels.shownItem === undefined
                ? prepItemId
                : prepPanels.shownItem
            }
          >
            <CommandScope value={visibleId === 'prep' ? 'visible' : 'hidden'}>
              {columnFrame('prep', prepPanels, {visible: visibleId === 'prep'})}
            </CommandScope>
          </ShownItemProvider>
        </div>
        {visibleId === 'screens' ? (
          <div className={styles.frameSlot}>
            {columnFrame('screens', screens)}
          </div>
        ) : null}
      </div>
      {mediaOpen && api !== undefined ? (
        <ResizeGap
          axis="row"
          name="media.bin"
          begin={() => mediaRows.begin(0)}
          disabled={!mediaRows.canResize(0)}
        />
      ) : null}
      {visibleId !== 'screens' && api !== undefined ? (
        <MediaBin
          workspace={visibleId}
          open={mediaOpen}
          onOpenChange={onMediaOpenChange}
          onProblem={onProblem ?? ignoreProblem}
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
        onProblem={onProblem ?? ignoreProblem}
      >
        {frame}
      </MediaViewProvider>
    );
  return (
    <ShowSlideEntry value={navigation.slideEntry}>{content}</ShowSlideEntry>
  );
}
