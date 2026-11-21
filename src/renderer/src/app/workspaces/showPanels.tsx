import {useState, type ReactNode} from 'react';
import {ShownItemProvider, useShownItemId} from '@renderer/session/shownItem';
import {PanelTitle} from '@renderer/ui/Panel';
import type {SongId} from '@core/schema/ids';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {ClearRow} from '@renderer/features/presentation/ClearRow';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlidePanelFooter,
} from '@renderer/features/presentation/SlidePanel';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';
import {useLibrarySongSync} from '@renderer/features/presentation/useLibrarySongSync';
import {BibleSplitTools} from '@renderer/features/bible/BibleSplitTools';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {ShowToolsPanel} from '@renderer/features/tools/ShowToolsPanel';
import {useShow} from '@renderer/session/show';
import {
  useSettingsDocument,
  type NamedDocument,
} from '@renderer/platform/useSettingsDocument';
import {bibleSourceFor, isBibleSource} from '@renderer/session/showLibrary';
import type {Notice} from '@renderer/ui/notices';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';
import panelStyles from '../shell/Workspace.module.css';

const SHOW_COLUMNS = [
  [SERVICE_ORDER, '빠른 실행'],
  ['슬라이드'],
  ['미리보기', '지우기', '진행 도구'],
] as const;

/** Keep the ordinary and quick Bible panels alive while switching between them. */
function ShowSlidesPanel({
  sizeClass,
  onProblem,
  onOpenPrep,
  bibleOpen,
}: {
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep:
    ((itemId: string, position?: number) => void) | undefined;
  readonly bibleOpen: boolean;
}) {
  const item = useShownItemId();
  const [normal, setNormal] = useState<string | null>(bibleOpen ? null : item);
  const source = useShow(view => bibleSourceFor(view, item));
  const [bibles, setBibles] = useState<Array<NonNullable<typeof source>>>([]);
  if (
    bibleOpen &&
    source !== null &&
    !bibles.some(bible => bible.id === source.id)
  ) {
    setBibles([...bibles, source]);
  }
  if (!bibleOpen && item !== normal) setNormal(item);
  return (
    <>
      <div
        data-slide-grid-cache
        aria-hidden={bibleOpen}
        inert={bibleOpen}
        style={{display: bibleOpen ? 'none' : 'flex', flex: 1, minHeight: 0}}
      >
        <ShownItemProvider shownItem={normal} trackLive={false}>
          <section className={panelStyles.panel} aria-label="슬라이드">
            <div className={panelStyles.header}>
              <PanelTitle title="내용" />
              <SlidePanelMeta onProblem={onProblem} />
            </div>
            <div
              className={`${panelStyles.body} ${panelStyles.stableScrollbar}`}
            >
              <SlidePanelBody
                sizeClass={sizeClass}
                onOpenPrep={onOpenPrep}
                active={!bibleOpen}
              />
            </div>
            <SlidePanelFooter sizeClass={sizeClass} />
          </section>
        </ShownItemProvider>
      </div>
      {bibles.map(bible => (
        <div
          key={bible.id}
          data-slide-grid-cache
          aria-hidden={!bibleOpen || item !== bible.id}
          inert={!bibleOpen || item !== bible.id}
          style={{
            display: bibleOpen && item === bible.id ? 'flex' : 'none',
            flex: 1,
            minHeight: 0,
          }}
        >
          <ShownItemProvider shownItem={bible.id} trackLive={false}>
            <BiblePanel
              sizeClass={sizeClass}
              onProblem={onProblem}
              active={bibleOpen && item === bible.id}
              retainedSource={bible}
            />
          </ShownItemProvider>
        </div>
      ))}
    </>
  );
}

/** The 진행 keys and the 라이브러리 song sync, while 진행 is open. */
export function ShowShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): ReactNode {
  useShowKeys();
  useLibrarySongSync(onProblem);
  return <BibleSplitTools onProblem={onProblem} />;
}

function showPanelParts({
  title,
  sizeClass,
  onProblem,
  bibleOpen,
  bibleSelection,
  onOpenPrep,
  quickDocument,
}: {
  readonly title: string;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly bibleOpen: boolean;
  readonly bibleSelection: number;
  readonly onOpenPrep:
    ((itemId: string, position?: number) => void) | undefined;
  readonly quickDocument: NamedDocument<'quick'> | null;
}): PanelParts {
  switch (title) {
    case '빠른 실행':
      return {
        size: 'content',
        embedded: (
          <QuickPanel
            selectionVersion={bibleSelection}
            onProblem={onProblem ?? logPanelProblem}
            initialDocument={quickDocument}
          />
        ),
      };
    case '미리보기':
      return {
        size: 'fit',
        embedded: <PreviewPanel />,
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
      return {
        embedded: (
          <ShowSlidesPanel
            sizeClass={sizeClass}
            onProblem={onProblem}
            onOpenPrep={onOpenPrep}
            bibleOpen={bibleOpen}
          />
        ),
      };
    default:
      return {};
  }
}

/** The panels of 진행. */
export function useShowPanels({
  active,
  sizeClass,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
  sidebarAction,
}: {
  readonly active: boolean;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep:
    ((itemId: string, position?: number) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
  readonly sidebarAction: ReactNode;
}): WorkspacePanels {
  const [bibleSelection, setBibleSelection] = useState(0);
  const quickDocument = useSettingsDocument('quick', '빠른 실행', onProblem);
  const shownItemId = useShownItemId();
  const bibleOpen = useShow(view => active && isBibleSource(view, shownItemId));
  return {
    columns: SHOW_COLUMNS,
    partsOf: title =>
      title === SERVICE_ORDER
        ? serviceOrderParts({
            workspace: 'show',
            onProblem,
            onOpenPrep,
            onShowInLibrary,
            onOpenItem: () => setBibleSelection(value => value + 1),
            actions: sidebarAction,
          })
        : showPanelParts({
            title,
            sizeClass,
            onProblem,
            bibleOpen,
            bibleSelection,
            onOpenPrep,
            quickDocument,
          }),
  };
}
