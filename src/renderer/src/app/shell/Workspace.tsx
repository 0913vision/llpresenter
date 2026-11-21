import {PaletteEditingProvider} from '@renderer/features/service/items/PaletteEditing';
import type {SongId} from '@core/schema/ids';
import {
  Fragment,
  Suspense,
  useCallback,
  useRef,
  useState,
  type JSX,
} from 'react';
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
import {logPanelProblem, type WorkspacePanels} from './WorkspacePanel';
import {PanelColumn} from './PanelColumn';
import {ResizeGap} from '@renderer/ui/ResizeGap';
import {useRowLayout} from '@renderer/ui/useRowLayout';
import styles from './Workspace.module.css';
import {
  ShowSlideEntry,
  useShowPanelNavigation,
} from '@renderer/features/presentation/showPanelNavigation';
import {OpenItemPrefetch} from '@renderer/features/presentation/SlidePicturePrefetch';
import {TableDataKeeper} from '@renderer/features/service/table/useServiceTableData';
import {PrepPictureSwitch} from '@renderer/rendering/PrepPictureSwitch';
import {ShownItemProvider} from '@renderer/session/shownItem';
import {returnFocus} from '@renderer/ui/returnFocus';
import {KeptPrepFrames} from './KeptPrepFrames';

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
  const toggle = (
    collapsed: boolean,
    button: HTMLButtonElement,
    keyboard: boolean,
  ): void => {
    const focused = document.activeElement === button;
    pendingFocus.current = keyboard && focused;
    if (!keyboard && focused) returnFocus(null);
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
  prepItemId,
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
  readonly prepItemId?: string | null | undefined;
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
  const screens = useScreensPanels({
    active: id === 'screens',
    onProblem,
    leaveGuard: themeLeave,
  });
  const [lastVisible, setLastVisible] = useState<WorkspaceId>('show');
  const visibleId = id === 'screens' && !screens.ready ? lastVisible : id;
  if (visibleId !== lastVisible) setLastVisible(visibleId);
  const showVisible = visibleId === 'show';
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
  const panelColumns = (
    workspace: WorkspaceId,
    {columns, partsOf}: WorkspacePanels,
    collapsed: boolean,
  ): JSX.Element[] =>
    columns.map((titles, column) => (
      <Fragment key={column}>
        {column === 1 && collapsed ? <div aria-hidden="true" /> : null}
        {column > 0 && !(column === 1 && collapsed) ? (
          <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
        ) : null}
        {column === 0 && collapsed ? (
          <div className={styles.column} data-panel="예배 순서">
            <CollapsedSidebar
              claimFocus={toggle.claimFocus}
              onPress={(button, keyboard) =>
                toggle.toggle(false, button, keyboard)
              }
            />
          </div>
        ) : (
          <PanelColumn
            workspace={workspace}
            titles={titles}
            partsOf={partsOf}
            store={store}
            sizeClass={sizeClass}
            draft={columns[1]?.[0] === '편집'}
            warningHeight={column === columns.length - 1 ? warningHeight : 0}
          />
        )}
      </Fragment>
    ));
  const columnFrame = (
    workspace: WorkspaceId,
    panels: WorkspacePanels,
    {
      collapsed,
      visible,
    }: {readonly collapsed: boolean; readonly visible: boolean},
  ): JSX.Element => (
    <div
      data-size={sizeClass}
      inert={!visible}
      className={classNames(
        styles.columns,
        collapsed && styles.leftCollapsed,
        workspace === 'screens' && styles.screenSettings,
      )}
    >
      {workspace === 'prep' ? (
        <PaletteEditingProvider onProblem={onProblem ?? ignoreProblem}>
          {panelColumns(workspace, panels, collapsed)}
        </PaletteEditingProvider>
      ) : (
        panelColumns(workspace, panels, collapsed)
      )}
    </div>
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
      <OpenItemPrefetch />
      {prep === undefined ? null : <TableDataKeeper api={prep.api} />}
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
          <Suspense fallback={null}>
            {columnFrame('show', show, {
              collapsed: toggle.collapsed,
              visible: showVisible,
            })}
          </Suspense>
        </div>
        <div
          className={classNames(
            styles.frameSlot,
            visibleId !== 'prep' && styles.hiddenFrame,
          )}
          data-workspace-frame="prep"
          data-prep-frame
          data-prep-item={prepPanels.shownItem ?? prepItemId ?? undefined}
          data-prep-settled={
            prepPanels.pictureIdentity?.startsWith('edit:') ? 'true' : 'false'
          }
          inert={visibleId !== 'prep'}
          aria-hidden={visibleId !== 'prep'}
        >
          <KeptPrepFrames identity={prepPanels.pictureIdentity ?? 'table'}>
            <ShownItemProvider
              shownItem={
                prepPanels.shownItem === undefined
                  ? prepItemId
                  : prepPanels.shownItem
              }
            >
              <PrepPictureSwitch
                identity={prepPanels.pictureIdentity ?? 'table'}
              >
                {columnFrame('prep', prepPanels, {
                  collapsed: false,
                  visible: visibleId === 'prep',
                })}
              </PrepPictureSwitch>
            </ShownItemProvider>
          </KeptPrepFrames>
        </div>
        {visibleId === 'screens' ? (
          <div className={styles.frameSlot}>
            {columnFrame('screens', screens, {collapsed: false, visible: true})}
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
