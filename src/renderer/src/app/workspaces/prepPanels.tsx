import {useSyncExternalStore, type RefObject} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongId} from '@core/schema/ids';
import {ItemPreviewPanel} from '@renderer/features/service/items/ItemSidePanels';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';
import {InlineSongActions} from './InlineSongActions';
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
import {SlidesEditor} from '@renderer/features/service/slides/SlidesEditor';
import {InlineSlidesPanels} from '@renderer/features/service/slides/InlineSlidesPanels';
import type {SlidesEditorModel} from '@renderer/features/service/slides/useSlidesEditor';

const PREP_COLUMNS = [
  ['라이브러리'],
  [SERVICE_ORDER],
  ['미리보기', '슬라이드'],
] as const;

const PREP_DRAFT_COLUMNS = [
  ['라이브러리'],
  ['편집'],
  ['미리보기', '슬라이드'],
] as const;

/** What 준비 works on: the API, the song editor, and the item panels. */
export interface PrepBinding {
  readonly controls?: RefObject<SongEditorWindowModel | null>;
  readonly slides?: SlidesEditorModel;
  readonly onNewSong?: (() => void) | undefined;
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
        onNewSong={prep.onNewSong}
        beforeOpen={open => prep.editor.requestLeave(open)}
        onOpenSong={selection =>
          prep.editor.open(selection.document, {
            block: selection.position ?? 0,
            focusTitle: selection.focusTitle,
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
  itemEditor,
  onProblem,
  sizeClass,
}: {
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly hasDraft: boolean;
  readonly itemEditor: boolean;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly sizeClass: SizeClass;
}): PanelParts {
  if (!prep) return {};
  const back = (): void =>
    prep.editor.requestLeave(() => prep.editor.open(null));
  if (title === '라이브러리') return libraryParts(prep, onProblem);
  if (title === '편집') {
    if (prep.slides?.draft !== null && prep.slides !== undefined) {
      return {
        embedded: (
          <SlidesEditor api={prep.api} model={prep.slides} onBack={back} />
        ),
      };
    }
    return {
      embedded: (
        <SongEditor
          store={prep.editor}
          onImportedSave={prep.onImportedSave}
          onBack={back}
          actions={
            prep.controls === undefined ? null : (
              <InlineSongActions
                store={prep.editor}
                controlsRef={prep.controls}
                onProblem={onProblem ?? ignoreProblem}
              />
            )
          }
        />
      ),
    };
  }
  if (title === '미리보기') {
    if (prep.slides?.session) {
      return {
        size: 'content',
        embedded: (
          <InlineSlidesPanels
            api={prep.api}
            session={prep.slides.session}
            preview
            onBack={back}
          />
        ),
      };
    }
    return {
      size: 'content',
      embedded:
        hasDraft && !itemEditor ? (
          <SongPreviewPanel store={prep.editor} />
        ) : (
          <ItemPreviewPanel items={prep.items} editor={prep.editor} />
        ),
    };
  }
  if (title === '슬라이드') {
    if (prep.slides?.session) {
      return {
        size: 'rest',
        embedded: (
          <InlineSlidesPanels
            api={prep.api}
            session={prep.slides.session}
            onBack={back}
          />
        ),
      };
    }
    return {
      size: 'rest',
      embedded:
        hasDraft && !itemEditor ? (
          <SongSlidePanel
            store={prep.editor}
            sizeClass={sizeClass}
            onBack={back}
          />
        ) : (
          <ServiceItemPanel
            items={prep.items}
            editor={prep.editor}
            slides={prep.slides}
            sizeClass={sizeClass}
            onBack={hasDraft ? back : undefined}
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
  const editorKind = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => {
      const session = prep?.editor.getSnapshot().session;
      return session == null
        ? 'table'
        : session.itemSession
          ? 'item'
          : 'library';
    },
  );
  const hasDraft = editorKind !== 'table' || prep?.slides?.draft != null;
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
        : prepPanelParts({
            title,
            prep,
            hasDraft,
            itemEditor: editorKind === 'item',
            onProblem,
            sizeClass,
          }),
  };
}
