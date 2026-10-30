import {useSyncExternalStore} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongId} from '@core/schema/ids';
import {
  ItemPreviewPanel,
  ItemSettingsPanel,
} from '@renderer/features/service/items/ItemSidePanels';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import type {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {
  SongEditor,
  SongPreviewPanel,
  SongSlidePanel,
  type SongEditorStore,
} from '@renderer/features/songs/editor';
import {
  LibraryPanel,
  type LibrarySelectionRequest,
} from '@renderer/features/songs/library/LibraryPanel';
import type {Notice} from '@renderer/ui/notices';
import type {SizeClass} from '@renderer/ui/sizeClass';
import type {PanelParts, WorkspacePanels} from '../shell/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';

const PREP_COLUMNS = [
  [SERVICE_ORDER, '라이브러리'],
  ['편집'],
  ['미리보기', '항목 설정'],
] as const;

const PREP_SONG_COLUMNS = [
  [SERVICE_ORDER, '라이브러리'],
  ['편집'],
  ['미리보기', '슬라이드'],
] as const;

/** What 준비 works on: the API, the song editor, and the item panels. */
export interface PrepBinding {
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

function libraryParts(
  prep: PrepBinding,
  onProblem: ((notice: Notice) => void) | undefined,
): PanelParts {
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
            const number = session?.arrangementOrder.slides[selection.position];
            if (number !== undefined) {
              session?.select({block: number - 1, start: 0, end: 0});
            }
          }
        }}
      />
    ),
  };
}

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
  if (title === '라이브러리') return libraryParts(prep, onProblem);
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

/** The panels of 준비; the song panels replace the item panels while a song is open. */
export function usePrepPanels({
  prep,
  sizeClass,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
}: {
  readonly prep: PrepBinding | undefined;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
}): WorkspacePanels {
  const hasSong = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => Boolean(prep?.editor.getSnapshot().session),
  );
  return {
    columns: hasSong ? PREP_SONG_COLUMNS : PREP_COLUMNS,
    partsOf: title =>
      title === SERVICE_ORDER
        ? serviceOrderParts({
            workspace: 'prep',
            onProblem,
            onOpenPrep,
            onShowInLibrary,
            onOpenItem: () => openPrepItem(prep),
            actions: null,
          })
        : prepPanelParts({title, prep, hasSong, onProblem, sizeClass}),
  };
}
