import {useState, type ReactNode} from 'react';
import type {SongId} from '@core/schema/ids';
import {BiblePanel} from '@renderer/features/presentation/BiblePanel';
import {ClearRow} from '@renderer/features/presentation/ClearRow';
import {PreviewPanel} from '@renderer/features/presentation/PreviewPanel';
import {
  SlidePanelBody,
  SlidePanelMeta,
  SlideSizeControl,
} from '@renderer/features/presentation/SlidePanel';
import {useShowKeys} from '@renderer/features/presentation/shortcuts';
import {useLibrarySongSync} from '@renderer/features/presentation/useLibrarySongSync';
import {QuickPanel} from '@renderer/features/quick/QuickPanel';
import {SongBackgroundControl} from '@renderer/features/service/items/SongBackgroundControl';
import {ShowToolsPanel} from '@renderer/features/tools/ShowToolsPanel';
import {useShow} from '@renderer/session/show';
import {isBibleSource} from '@renderer/session/showLibrary';
import type {Notice} from '@renderer/ui/notices';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';

const SHOW_COLUMNS = [
  [SERVICE_ORDER, '퀵 실행'],
  ['슬라이드'],
  ['미리보기', '지우기', '진행 도구'],
] as const;

/** The 진행 keys and the 라이브러리 song sync, while 진행 is open. */
export function ShowShortcuts({
  onProblem,
}: {
  readonly onProblem: (notice: Notice) => void;
}): null {
  useShowKeys();
  useLibrarySongSync(onProblem);
  return null;
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
  const bibleOpen = useShow(
    view => active && isBibleSource(view, view.openItemId),
  );
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
          }),
  };
}
