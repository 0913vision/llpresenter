import {useState, type ReactNode} from 'react';
import {useShownItemId} from '@renderer/session/show/shownItem';
import type {SongId} from '@core/schema/common/ids';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {ClearRow} from '@renderer/features/presentation/ClearRow';
import {PreviewPanel} from '@renderer/features/presentation/preview/PreviewPanel';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlidePanelFooter,
} from '@renderer/features/presentation/grid/SlidePanel';
import {useShowKeys} from '@renderer/features/presentation/keyboard/showKeys';
import {useLibrarySongSync} from '@renderer/features/presentation/useLibrarySongSync';
import {useVerseSplit} from '@renderer/features/bible/split/useVerseSplit';
import {useItemDeck} from '@renderer/features/slides/slideDeck';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {ShowToolsPanel} from '@renderer/features/tools/ShowToolsPanel';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {isBibleSource, tilesForView} from '@renderer/session/show/showLibrary';
import type {Notice} from '@renderer/ui/popups/notices';
import type {SizeClass} from '@renderer/ui/panels/sizeClass';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/workspace/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';
import {useShow} from '@renderer/session/show/showStore';
import {type NamedDocument} from '@core/schema/app/settingsDocuments';

const SHOW_COLUMNS = [
  [SERVICE_ORDER, '빠른 실행'],
  ['슬라이드'],
  ['미리보기', '지우기', '진행 도구'],
] as const;

/** The 진행 keys and the 라이브러리 song sync, while 진행 is open. */
export function ShowShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): ReactNode {
  useShowKeys();
  useLibrarySongSync(onProblem);
  const itemId = useShownItemId();
  const slideId = useShow(view =>
    itemId === null
      ? undefined
      : tilesForView(view, itemId)[view.selectedTile]?.slide.id,
  );
  const deck = useItemDeck(itemId, onProblem);
  const split = useVerseSplit(deck, onProblem, slideId);
  return split.dialog;
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
      if (bibleOpen) {
        return {
          embedded: (
            <BiblePanel
              sizeClass={sizeClass}
              onProblem={onProblem ?? logPanelProblem}
            />
          ),
        };
      }
      return {
        body: <SlidePanelBody sizeClass={sizeClass} onOpenPrep={onOpenPrep} />,
        header: <SlidePanelMeta />,
        footer: <SlidePanelFooter sizeClass={sizeClass} />,
        stableScrollbar: true,
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
