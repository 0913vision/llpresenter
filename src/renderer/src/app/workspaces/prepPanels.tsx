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
  ['라이브러리'],
  [SERVICE_ORDER],
  ['미리보기', '슬라이드', '항목 설정'],
] as const;

// NOTE(0913vision): A text import or a new song is a draft with no library
// file yet, so the 곡 편집 window can't open it. While the editor holds one,
// 준비 swaps the table for the editor, as before.
// TODO(0913vision): Remove this layout once the 곡 편집 window opens drafts.
const PREP_DRAFT_COLUMNS = [
  ['라이브러리'],
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

function openSongWindow(
  api: LlpApi,
  target: {readonly songId: SongId; readonly block: number},
): void {
  api.window
    .openSongEditor(target)
    .then(result => {
      if (!result.ok) {
        console.error('Could not open the song editor', result.error.reason);
      }
    })
    .catch((error: unknown) =>
      console.error('Could not open the song editor', error),
    );
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
        onOpenSong={selection =>
          openSongWindow(prep.api, {
            songId: selection.document.song.id,
            block: selection.position ?? 0,
          })
        }
      />
    ),
  };
}

function prepPanelParts({
  title,
  prep,
  hasDraft,
  onProblem,
  sizeClass,
}: {
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly hasDraft: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly sizeClass: SizeClass;
}): PanelParts {
  if (!prep) return {};
  if (title === '라이브러리') return libraryParts(prep, onProblem);
  if (title === '편집') {
    return {
      body: (
        <SongEditor store={prep.editor} onImportedSave={prep.onImportedSave} />
      ),
    };
  }
  if (title === '미리보기') {
    return {
      size: 'content',
      embedded: hasDraft ? (
        <SongPreviewPanel store={prep.editor} />
      ) : (
        <ItemPreviewPanel items={prep.items} editor={prep.editor} />
      ),
    };
  }
  if (title === '항목 설정') {
    return {
      size: 'settings',
      embedded: <ItemSettingsPanel items={prep.items} editor={prep.editor} />,
    };
  }
  if (title === '슬라이드') {
    return {
      size: 'list',
      embedded: hasDraft ? (
        <SongSlidePanel store={prep.editor} sizeClass={sizeClass} />
      ) : (
        <ServiceItemPanel
          items={prep.items}
          editor={prep.editor}
          sizeClass={sizeClass}
        />
      ),
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

/** The panels of 준비: 라이브러리, the 예배 순서 table, and the selected item. */
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
  const hasDraft = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => Boolean(prep?.editor.getSnapshot().session),
  );
  return {
    columns: hasDraft ? PREP_DRAFT_COLUMNS : PREP_COLUMNS,
    partsOf: title =>
      title === SERVICE_ORDER
        ? serviceOrderParts({
            workspace: 'prep',
            onProblem,
            onOpenPrep,
            onShowInLibrary,
            onOpenItem: () => openPrepItem(prep),
            actions: null,
            table:
              prep === undefined
                ? undefined
                : {api: prep.api, items: prep.items},
          })
        : prepPanelParts({title, prep, hasDraft, onProblem, sizeClass}),
  };
}
