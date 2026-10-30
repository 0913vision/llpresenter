import type {SongId} from '@core/schema/ids';
import {
  Fragment,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import {
  LibraryPanel,
  type LibrarySelectionRequest,
} from '@renderer/features/songs/library/LibraryPanel';
import {
  SongEditor,
  SongPreviewPanel,
  SongSlidePanel,
  type SongEditorStore,
} from '@renderer/features/songs/editor';
import {
  ItemPreviewPanel,
  ItemSettingsPanel,
} from '@renderer/features/service/items/ItemSidePanels';
import {ServiceQuickAdd} from '@renderer/features/service/items/QuickAdd';
import {MediaBin} from '@renderer/features/media/MediaBin';
import type {MediaApi} from '@renderer/features/media/mediaLibrary';
import {MediaViewProvider} from '@renderer/features/media/MediaViewProvider';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import type {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {ClearRow} from '@renderer/show/ClearRow';
import {PreviewPanel} from '@renderer/show/PreviewPanel';
import {ServiceOrderHeader} from '@renderer/features/service/order/ServiceOrderHeader';
import {ServiceOrderList} from '@renderer/features/service/order/ServiceOrderList';
import {ShowToolsPanel} from '@renderer/show/ShowToolsPanel';
import {SongBackgroundControl} from '@renderer/features/media/SongBackgroundControl';
import {ReadOnlyMark} from '@renderer/show/ReadOnlyMark';
import {QuickPanel} from '@renderer/show/quick/QuickPanel';
import {BiblePanel} from '@renderer/features/bible/BiblePanel';
import {useShow} from '@renderer/state/show';
import {isBibleSource} from '@renderer/state/showLibrary';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlideSizeControl,
} from '@renderer/show/SlidePanel';
import {useShowKeys} from '@renderer/show/shortcuts';
import {useLibrarySongSync} from '@renderer/show/useLibrarySongSync';
import {DisplayLayout} from '@renderer/screens/DisplayLayout';
import {StageCanvas} from '@renderer/screens/stage/StageCanvas';
import {StageProperties} from '@renderer/screens/stage/StageProperties';
import {OutputPreview} from '@renderer/screens/OutputPreview';
import {ScreenList} from '@renderer/screens/ScreenList';
import {ScreenProperties} from '@renderer/screens/ScreenProperties';
import {LookList, StageLayoutList} from '@renderer/screens/LookLists';
import {LookEditor} from '@renderer/screens/looks/LookEditor';
import {useScreensSelection} from '@renderer/screens/selection';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/notices';
import {ColumnGap} from './ColumnGap';
import {CollapsedSidebar, SidebarCollapseButton} from './SidebarToggle';
import type {ColumnWidthStore} from './columnWidthStore';
import type {SizeClass} from '../../ui/sizeClass';
import type {Workspace as WorkspaceId} from './Toolbar';
import {useColumnLayout} from './useColumnLayout';
import type {SidebarCollapse} from './useSidebarCollapse';
import styles from './Workspace.module.css';

type ColumnPanels = readonly string[];

const panelsByWorkspace: Readonly<
  Record<WorkspaceId, readonly [ColumnPanels, ColumnPanels, ColumnPanels]>
> = {
  show: [
    ['예배 순서', '퀵 실행'],
    ['슬라이드'],
    ['미리보기', '지우기', '진행 도구'],
  ],
  prep: [['예배 순서', '라이브러리'], ['편집'], ['미리보기', '항목 설정']],
  screens: [['화면', 'Look', '무대 배치'], ['배치', '출력 미리보기'], ['속성']],
};

interface PanelParts {
  readonly embedded?: ReactNode;
  // NOTE(0913vision): `bare` draws its content without the panel around it,
  // as the 지우기 row does.
  readonly bare?: ReactNode;
  // NOTE(0913vision): `content` sizes the panel to its content, and it shrinks
  // before `rest` does. `rest` takes the height that is left, at least the
  // height of the 진행 도구.
  readonly size?: 'content' | 'rest';
  readonly header?: ReactNode;
  readonly body?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  // NOTE(0913vision): A body whose content sizes itself from the body width
  // keeps room for the scrollbar, so a scrollbar that appears doesn't narrow
  // the content, which would make it shorter and hide the scrollbar again.
  readonly stableScrollbar?: boolean;
}

function sizedClass(
  base: string | undefined,
  size: PanelParts['size'],
): string {
  return classNames(
    base,
    size === 'content' && styles.content,
    size === 'rest' && styles.rest,
  );
}

function Panel({
  title,
  parts,
}: {
  readonly title: string;
  readonly parts: PanelParts;
}): JSX.Element {
  if (parts.embedded) {
    return (
      <div className={sizedClass(styles.embedded, parts.size)}>
        {parts.embedded}
      </div>
    );
  }
  if (parts.bare) return <div className={styles.bare}>{parts.bare}</div>;
  return (
    <section
      className={sizedClass(styles.panel, parts.size)}
      aria-label={title}
    >
      <div className={styles.header}>
        {parts.header ?? <span className={styles.tab}>{title}</span>}
        {parts.meta}
        {parts.actions ? (
          <div className={styles.actions}>{parts.actions}</div>
        ) : null}
      </div>
      <div
        className={
          parts.stableScrollbar
            ? `${styles.body} ${styles.stableScrollbar}`
            : styles.body
        }
      >
        {parts.body}
      </div>
      {parts.footer ? (
        <div className={styles.footer}>{parts.footer}</div>
      ) : null}
    </section>
  );
}

function ShowShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): null {
  useShowKeys();
  useLibrarySongSync(onProblem);
  return null;
}

function logPanelProblem(notice: Notice): void {
  console.error('Workspace panel failed:', notice.key);
}

function showPanelParts({
  title,
  sizeClass,
  onProblem,
  bibleOpen,
  bibleSelection,
  onOpenPrep,
}: {
  readonly title: string;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly bibleOpen: boolean;
  readonly bibleSelection: number;
  readonly onOpenPrep:
    ((itemId: string, position?: number) => void) | undefined;
}): PanelParts {
  switch (title) {
    case '퀵 실행':
      return {
        size: 'content',
        embedded: (
          <QuickPanel
            selectionVersion={bibleSelection}
            onProblem={onProblem ?? logPanelProblem}
          />
        ),
      };
    case '미리보기':
      return {
        size: 'content',
        body: <PreviewPanel compact={sizeClass === 'narrow'} />,
      };
    case '진행 도구':
      return {
        size: 'rest',
        embedded: (
          <ShowToolsPanel
            sizeClass={sizeClass}
            onProblem={onProblem ?? logPanelProblem}
          />
        ),
      };
    case '지우기':
      return {bare: <ClearRow compact={sizeClass === 'narrow'} />};
    case '슬라이드':
      if (bibleOpen) {
        return {
          embedded: <BiblePanel sizeClass={sizeClass} onProblem={onProblem} />,
        };
      }
      return {
        body: <SlidePanelBody sizeClass={sizeClass} onOpenPrep={onOpenPrep} />,
        meta: (
          <>
            <SlidePanelMeta />
            <SongBackgroundControl onProblem={onProblem} />
          </>
        ),
        footer: <SlideSizeControl sizeClass={sizeClass} />,
        stableScrollbar: true,
      };
    default:
      return {};
  }
}

function screensPanelParts(
  title: string,
  onProblem: ((notice: Notice) => void) | undefined,
): PanelParts {
  switch (title) {
    case '화면':
      return {body: <ScreenList onProblem={onProblem} />};
    case 'Look':
      return {embedded: <LookList onProblem={onProblem} />};
    case 'Look 편집':
      return {embedded: <LookEditor onProblem={onProblem} />};
    case '무대 배치':
      return {embedded: <StageLayoutList onProblem={onProblem} />};
    case '배치':
      return {body: <ScreenCanvas onProblem={onProblem} />};
    case '속성':
      return {body: <ScreenPropertiesOrStage onProblem={onProblem} />};
    case '출력 미리보기':
      return {body: <OutputPreview onProblem={onProblem} />};
    default:
      return {};
  }
}

function ScreenCanvas({
  onProblem,
}: {
  onProblem: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const stage = useScreensSelection(view => view.selection.kind === 'stage');
  return stage ? (
    <StageCanvas onProblem={onProblem} />
  ) : (
    <DisplayLayout onProblem={onProblem} />
  );
}

function ScreenPropertiesOrStage({
  onProblem,
}: {
  onProblem: ((notice: Notice) => void) | undefined;
}): JSX.Element | null {
  const stage = useScreensSelection(view => view.selection.kind === 'stage');
  return stage ? (
    <StageProperties onProblem={onProblem} />
  ) : (
    <ScreenProperties onProblem={onProblem} />
  );
}

interface PrepBinding {
  readonly onImportedSave?: ((id: SongId) => void) | undefined;
  readonly api: LlpApi;
  readonly editor: SongEditorStore;
  readonly items: ServiceItemStore;
  readonly selectionRequest?: LibrarySelectionRequest | undefined;
  readonly onSelectionHandled?:
    ((request: LibrarySelectionRequest) => void) | undefined;
  // NOTE(0913vision): Runs before a 예배 순서 item opens in 준비, ahead of the
  // editor, so a pending library selection can't replace the item's view.
  readonly onServiceItemOpen?: (() => void) | undefined;
}

const noSubscribe = (): (() => void) => () => undefined;
const ignoreProblem = (): void => undefined;

function prepPanelParts({
  title,
  prep,
  hasSong,
  onProblem,
  sizeClass,
}: {
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly hasSong: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly sizeClass: SizeClass;
}): PanelParts {
  if (!prep) return {};
  if (title === '라이브러리') {
    return {
      embedded: (
        <LibraryPanel
          api={prep.api}
          selectionRequest={prep.selectionRequest}
          onSelectionHandled={prep.onSelectionHandled}
          onProblem={onProblem ?? ignoreProblem}
          onOpenSong={selection => {
            prep.editor.open(selection.document, {
              focusTitle: selection.focusTitle,
            });
            if (selection.position !== undefined) {
              const session = prep.editor.getSnapshot().session;
              session?.selectArrangement(undefined);
              const number =
                session?.arrangementOrder.slides[selection.position];
              if (number !== undefined) {
                session?.select({block: number - 1, start: 0, end: 0});
              }
            }
          }}
        />
      ),
    };
  }
  if (title === '편집') {
    return !hasSong
      ? {
          embedded: (
            <ServiceItemPanel
              items={prep.items}
              editor={prep.editor}
              sizeClass={sizeClass}
            />
          ),
        }
      : {
          body: (
            <SongEditor
              store={prep.editor}
              onImportedSave={prep.onImportedSave}
            />
          ),
        };
  }
  if (title === '미리보기') {
    return {
      size: 'content',
      embedded: hasSong ? (
        <SongPreviewPanel store={prep.editor} />
      ) : (
        <ItemPreviewPanel items={prep.items} editor={prep.editor} />
      ),
    };
  }
  if (title === '항목 설정') {
    return {
      embedded: <ItemSettingsPanel items={prep.items} editor={prep.editor} />,
    };
  }
  if (title === '슬라이드') {
    return {
      embedded: <SongSlidePanel store={prep.editor} sizeClass={sizeClass} />,
    };
  }
  return {};
}

function openPrepItem(prep: PrepBinding | undefined): void {
  prep?.editor.requestLeave(() => {
    prep.onServiceItemOpen?.();
    prep.editor.open(null);
  });
}

function serviceOrderParts({
  id,
  prep,
  onProblem,
  onOpenPrep,
  actions,
  onShowSelection,
  onShowInLibrary,
}: {
  readonly id: Exclude<WorkspaceId, 'screens'>;
  readonly prep: PrepBinding | undefined;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly actions: ReactNode;
  readonly onShowSelection: () => void;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
}): PanelParts {
  return {
    header: <ServiceOrderHeader onProblem={onProblem} />,
    body: (
      <ServiceOrderList
        workspace={id}
        onProblem={onProblem}
        onOpenPrep={onOpenPrep}
        onShowInLibrary={onShowInLibrary}
        onOpenItem={id === 'prep' ? () => openPrepItem(prep) : onShowSelection}
      />
    ),
    meta: <ReadOnlyMark />,
    actions: (
      <>
        <ServiceQuickAdd onProblem={onProblem ?? logPanelProblem} />
        {actions}
      </>
    ),
  };
}

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

/** The three-column frame shared by all workspaces. */
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
  mediaApi,
  sidebar,
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
  readonly mediaApi?: MediaApi | undefined;
  readonly sidebar?: SidebarCollapse | undefined;
}): JSX.Element {
  const {gridRef, drag} = useColumnLayout(sizeClass, store);
  const lookEditing = useScreensSelection(
    view => id === 'screens' && view.selection.kind === 'look',
  );
  const [bibleSelection, setBibleSelection] = useState(0);
  const bibleOpen = useShow(
    view => id === 'show' && isBibleSource(view, view.openItemId),
  );
  const toggle = useSidebarToggle(id === 'show' ? sidebar : undefined);
  const hasSong = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => Boolean(prep?.editor.getSnapshot().session),
  );
  const stageEditing = useScreensSelection(
    view => view.selection.kind === 'stage',
  );
  const prepColumns =
    id === 'prep' && hasSong
      ? [['예배 순서', '라이브러리'], ['편집'], ['미리보기', '슬라이드']]
      : id === 'screens' && stageEditing
        ? [panelsByWorkspace.screens[0], ['배치'], panelsByWorkspace.screens[2]]
        : panelsByWorkspace[id];
  const api = mediaApi ?? prep?.api ?? window.llp;
  const mediaOpen = id !== 'screens' && mediaVisible;
  const columns = lookEditing
    ? [panelsByWorkspace.screens[0], ['Look 편집']]
    : prepColumns;
  const partsOf = (title: string): PanelParts => {
    if (title === '예배 순서' && id !== 'screens') {
      return serviceOrderParts({
        id,
        prep,
        onProblem,
        onOpenPrep,
        onShowInLibrary,
        onShowSelection: () => setBibleSelection(value => value + 1),
        actions: toggle.collapsible ? (
          <SidebarCollapseButton
            claimFocus={toggle.claimFocus}
            onPress={button => toggle.toggle(true, button)}
          />
        ) : null,
      });
    }
    if (id === 'screens') return screensPanelParts(title, onProblem);
    return id === 'show'
      ? showPanelParts({
          title,
          sizeClass,
          onProblem,
          bibleOpen,
          bibleSelection,
          onOpenPrep,
        })
      : prepPanelParts({title, prep, hasSong, onProblem, sizeClass});
  };
  const panelColumns = columns.map((panels, column) => (
    <Fragment key={column}>
      {column === 1 && toggle.collapsed ? <div aria-hidden="true" /> : null}
      {column > 0 && !(column === 1 && toggle.collapsed) ? (
        <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
      ) : null}
      <div
        className={styles.column}
        style={
          column === columns.length - 1 && warningHeight > 0
            ? {paddingTop: `calc(${warningHeight}px + var(--panel-gap))`}
            : undefined
        }
      >
        {column === 0 && toggle.collapsed ? (
          <CollapsedSidebar
            claimFocus={toggle.claimFocus}
            onPress={button => toggle.toggle(false, button)}
          />
        ) : (
          panels.map(title => (
            <Panel key={title} title={title} parts={partsOf(title)} />
          ))
        )}
      </div>
    </Fragment>
  ));
  // TODO(0913vision): Let the shrink rule ignore the hidden left width while
  // the left column is collapsed; it still counts the saved width now.
  const frame = (
    <main
      ref={gridRef}
      data-workspace-layout={id}
      className={classNames(
        styles.workspace,
        mediaOpen && api !== undefined && styles.mediaOpen,
      )}
    >
      {id === 'show' ? (
        <ShowShortcuts onProblem={onProblem ?? logPanelProblem} />
      ) : null}
      <div
        className={classNames(
          styles.columns,
          toggle.collapsed && styles.leftCollapsed,
          id === 'screens' && styles.screenSettings,
          lookEditing && styles.lookEditing,
        )}
      >
        {panelColumns}
      </div>
      {mediaOpen && api !== undefined ? (
        <MediaBin workspace={id} onProblem={onProblem ?? ignoreProblem} />
      ) : null}
    </main>
  );
  return api === undefined ? (
    frame
  ) : (
    <MediaViewProvider
      api={api}
      active={mediaOpen}
      onProblem={onProblem ?? ignoreProblem}
    >
      {frame}
    </MediaViewProvider>
  );
}
