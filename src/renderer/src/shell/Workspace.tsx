import {
  Fragment,
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
  type JSX,
  type ReactNode,
} from 'react';
import type {LlpApi} from '@shared/ipc';
import {
  LibraryPanel,
  type LibrarySelectionRequest,
} from '@renderer/prep/library/LibraryPanel';
import {
  SongEditor,
  SongPreviewPanel,
  SongSlidePanel,
  type SongEditorStore,
} from '@renderer/prep/editor';
import {
  ItemPreviewPanel,
  ItemSettingsPanel,
} from '@renderer/prep/service/ItemSidePanels';
import {ServiceQuickAdd} from '@renderer/prep/service/QuickAdd';
import {MediaView} from '@renderer/prep/media/MediaView';
import {ServiceItemPanel} from '@renderer/prep/service/SongItemPanel';
import type {ServiceItemStore} from '@renderer/prep/service/serviceItemStore';
import {ClearRow} from '@renderer/show/ClearRow';
import {PreviewPanel} from '@renderer/show/PreviewPanel';
import {ShowMediaPanel} from '@renderer/show/ShowMediaPanel';
import {ServiceOrderHeader} from '@renderer/show/ServiceOrderHeader';
import {ServiceOrderList} from '@renderer/show/ServiceOrderList';
import {ShowToolsPanel} from '@renderer/show/ShowToolsPanel';
import {SongBackgroundControl} from '@renderer/show/SongBackgroundControl';
import {ReadOnlyMark} from '@renderer/show/ReadOnlyMark';
import {QuickPanel} from '@renderer/show/quick/QuickPanel';
import {BiblePanel} from '@renderer/show/bible/BiblePanel';
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
import {OutputPreview} from '@renderer/screens/OutputPreview';
import {ScreenList} from '@renderer/screens/ScreenList';
import {LookList, StageLayoutList} from '@renderer/screens/LookLists';
import {classNames} from '@renderer/ui/classNames';
import type {Notice} from '@renderer/ui/notices';
import {ColumnGap} from './ColumnGap';
import {CollapsedSidebar, SidebarCollapseButton} from './SidebarToggle';
import type {ColumnWidthStore} from './columnWidthStore';
import type {SizeClass} from './sizeClass';
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
    ['슬라이드', '미디어'],
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
}: {
  readonly title: string;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly bibleOpen: boolean;
  readonly bibleSelection: number;
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
      return {size: 'rest', embedded: <ShowToolsPanel sizeClass={sizeClass} />};
    case '미디어':
      return {
        bare: <ShowMediaPanel onProblem={onProblem ?? logPanelProblem} />,
      };
    case '지우기':
      return {bare: <ClearRow compact={sizeClass === 'narrow'} />};
    case '슬라이드':
      if (bibleOpen) return {embedded: <BiblePanel sizeClass={sizeClass} />};
      return {
        body: <SlidePanelBody sizeClass={sizeClass} />,
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
      return {body: <LookList onProblem={onProblem} />};
    case '무대 배치':
      return {body: <StageLayoutList onProblem={onProblem} />};
    case '배치':
      return {body: <DisplayLayout onProblem={onProblem} />};
    case '출력 미리보기':
      return {size: 'content', body: <OutputPreview onProblem={onProblem} />};
    default:
      return {};
  }
}

interface PrepBinding {
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
  if (title === '미디어') {
    return {
      embedded: (
        <MediaView api={prep.api} onProblem={onProblem ?? ignoreProblem} />
      ),
    };
  }
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
      : {body: <SongEditor store={prep.editor} />};
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
  prep?.onServiceItemOpen?.();
  prep?.editor.open(null);
}

function serviceOrderParts({
  id,
  prep,
  onProblem,
  onOpenPrep,
  actions,
  onShowSelection,
}: {
  readonly id: Exclude<WorkspaceId, 'screens'>;
  readonly prep: PrepBinding | undefined;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly actions: ReactNode;
  readonly onShowSelection: () => void;
}): PanelParts {
  return {
    header: <ServiceOrderHeader onProblem={onProblem} />,
    body: (
      <ServiceOrderList
        workspace={id}
        onProblem={onProblem}
        onOpenPrep={onOpenPrep}
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
  prep,
  warningHeight = 0,
  mediaVisible = true,
  mediaView = false,
  sidebar,
}: {
  readonly id: WorkspaceId;
  readonly sizeClass: SizeClass;
  readonly store: ColumnWidthStore;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep?: ((itemId: string) => void) | undefined;
  readonly prep?: PrepBinding | undefined;
  readonly warningHeight?: number;
  readonly mediaVisible?: boolean | undefined;
  /** 준비 shows the media view in its center column (spec 05, "Layout"). */
  readonly mediaView?: boolean | undefined;
  readonly sidebar?: SidebarCollapse | undefined;
}): JSX.Element {
  const {gridRef, drag} = useColumnLayout(sizeClass, store);
  const [bibleSelection, setBibleSelection] = useState(0);
  const bibleOpen = useShow(
    view => id === 'show' && isBibleSource(view, view.openItemId),
  );
  const toggle = useSidebarToggle(id === 'show' ? sidebar : undefined);
  const hasSong = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => Boolean(prep?.editor.getSnapshot().session),
  );
  const prepColumns =
    id === 'prep' && hasSong
      ? [['예배 순서', '라이브러리'], ['편집'], ['미리보기', '슬라이드']]
      : panelsByWorkspace[id];
  const columns =
    id === 'prep' && mediaView
      ? prepColumns.map((panels, column) =>
          column === 1 ? ['미디어'] : panels,
        )
      : prepColumns;
  const partsOf = (title: string): PanelParts => {
    if (title === '예배 순서' && id !== 'screens') {
      return serviceOrderParts({
        id,
        prep,
        onProblem,
        onOpenPrep,
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
      ? showPanelParts({title, sizeClass, onProblem, bibleOpen, bibleSelection})
      : prepPanelParts({title, prep, hasSong, onProblem, sizeClass});
  };
  // TODO(0913vision): Let the shrink rule ignore the hidden left width while
  // the left column is collapsed; it still counts the saved width now.
  return (
    <main
      ref={gridRef}
      className={
        toggle.collapsed
          ? `${styles.columns} ${styles.leftCollapsed}`
          : styles.columns
      }
    >
      {id === 'show' ? (
        <ShowShortcuts onProblem={onProblem ?? logPanelProblem} />
      ) : null}
      {columns.map((panels, column) => (
        <Fragment key={column}>
          {column === 1 && toggle.collapsed ? <div aria-hidden="true" /> : null}
          {column > 0 && !(column === 1 && toggle.collapsed) ? (
            <ColumnGap column={column === 1 ? 'left' : 'right'} drag={drag} />
          ) : null}
          <div
            className={styles.column}
            style={
              column === 2 && warningHeight > 0
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
              panels
                .filter(
                  title => id !== 'show' || title !== '미디어' || mediaVisible,
                )
                .map(title => (
                  <Panel key={title} title={title} parts={partsOf(title)} />
                ))
            )}
          </div>
        </Fragment>
      ))}
    </main>
  );
}
