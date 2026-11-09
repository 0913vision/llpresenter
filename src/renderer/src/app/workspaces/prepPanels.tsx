import {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {SongId} from '@core/schema/ids';
import {songItemDesign} from '@renderer/features/service/items/SongItemDesign';
import {ItemPreviewPanel} from '@renderer/features/service/items/ItemSidePanels';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';
import {InlineSongActions} from './InlineSongActions';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {SlidesInspector} from '@renderer/features/service/slideInspector/SlidesInspector';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';
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
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {SizeClass} from '@renderer/ui/sizeClass';
import {
  logPanelProblem,
  type PanelParts,
  type WorkspacePanels,
} from '../shell/WorkspacePanel';
import {SERVICE_ORDER, serviceOrderParts} from './serviceOrderPanel';
import {SlidesEditor} from '@renderer/features/service/slides/SlidesEditor';
import {InlineSlidesPanels} from '@renderer/features/service/slides/InlineSlidesPanels';
import type {SlidesEditorModel} from '@renderer/features/service/slides/useSlidesEditor';
import {isEditorEscape} from '@renderer/features/songs/editor/editorEscape';
import {SlidesBackButton} from '@renderer/features/service/slides/SlidesBackButton';
import {useShow} from '@renderer/session/show';
import headerStyles from '@renderer/features/songs/editor/SongHeader.module.css';
import styles from './OtherPrepEditor.module.css';

const PREP_COLUMNS = [
  ['라이브러리'],
  [SERVICE_ORDER],
  ['미리보기', '슬라이드'],
] as const;

const PREP_DRAFT_COLUMNS = [
  [SERVICE_ORDER],
  ['편집'],
  ['슬라이드 속성'],
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
  navigating = false,
): PanelParts {
  return {
    embedded: (
      <LibraryPanel
        api={prep.api}
        navigating={navigating}
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
  otherEditor,
  onBack,
  onProblem,
  sizeClass,
}: {
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly hasDraft: boolean;
  readonly otherEditor: boolean;
  readonly onBack: () => void;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly sizeClass: SizeClass;
}): PanelParts {
  if (!prep) return {};
  const back = onBack;
  if (title === '라이브러리') return libraryParts(prep, onProblem, hasDraft);
  if (title === '편집') {
    if (otherEditor) {
      return {
        embedded: (
          <OtherPrepEditor prep={prep} sizeClass={sizeClass} onBack={back} />
        ),
      };
    }
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
          ui={prep.api.ui}
          renderDesign={songItemDesign(prep.api, prep.items)}
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
  if (title === '슬라이드 속성') {
    return {
      embedded: otherEditor ? (
        <OtherSlideInspector items={prep.items} editor={prep.editor} />
      ) : prep.slides?.session ? (
        <SlidesInspector api={prep.api} session={prep.slides.session} />
      ) : (
        <SlideInspector store={prep.editor} />
      ),
    };
  }
  if (title === '미리보기') {
    if (prep.slides?.session) {
      return {
        size: 'fit',
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
      size: 'fit',
      embedded:
        hasDraft && !otherEditor ? (
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
        hasDraft && !otherEditor ? (
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
          />
        ),
    };
  }
  return {};
}

function OtherPrepEditor({
  prep,
  sizeClass,
  onBack,
}: {
  readonly prep: PrepBinding;
  readonly sizeClass: SizeClass;
  readonly onBack: () => void;
}) {
  const serviceName = useShow(view => view.serviceName);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const escape = (event: KeyboardEvent): void => {
      if (!isEditorEscape(event, root.current)) return;
      event.preventDefault();
      event.stopPropagation();
      onBack();
    };
    document.addEventListener('keydown', escape, true);
    return () => document.removeEventListener('keydown', escape, true);
  }, [onBack]);
  return (
    <div ref={root} className={styles.root}>
      <header className={headerStyles.header} data-inline="true">
        <SlidesBackButton serviceName={serviceName} onBack={onBack} />
      </header>
      <ServiceItemPanel
        items={prep.items}
        editor={prep.editor}
        slides={prep.slides}
        sizeClass={sizeClass}
      />
    </div>
  );
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
  const [otherId, setOtherId] = useState<string | null>(null);
  const leaveTurn = useRef(0);
  const otherService = useRef<string | null>(null);
  const serviceId = useShow(view => view.serviceId);
  const otherExists = useShow(
    view => otherId !== null && view.rows.some(row => row.id === otherId),
  );
  useEffect(() => {
    if (
      otherId !== null &&
      (serviceId !== otherService.current || !otherExists)
    ) {
      leaveTurn.current++;
      setOtherId(null);
    }
  }, [otherId, serviceId, otherExists]);
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
  const hasDraft =
    editorKind !== 'table' || prep?.slides?.draft != null || otherId !== null;
  const editorId = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => prep?.editor.getSnapshot().session?.document.song.id ?? null,
  );
  const origin = useRef<{id: string; library: boolean} | null>(null);
  useLayoutEffect(() => {
    const slides = prep?.slides?.draft;
    if (hasDraft) {
      const id = otherId ?? slides?.snapshot.item.id ?? editorId;
      origin.current =
        id === null ? null : {id, library: editorKind === 'library'};
      return;
    }
    const previous = origin.current;
    origin.current = null;
    if (previous === null) return;
    const label = previous.library ? '라이브러리 곡' : '예배 순서';
    const list = document.querySelector<HTMLElement>(
      `[data-workspace-layout="prep"] [role="listbox"][aria-label="${label}"]`,
    );
    const row =
      list?.querySelector<HTMLElement>(`[data-value="${previous.id}"]`) ??
      list?.querySelector<HTMLElement>('[aria-selected="true"]');
    row?.focus({preventScroll: true});
    row?.scrollIntoView({block: 'nearest'});
  }, [prep, hasDraft, editorId, editorKind, otherId]);
  const leave = (next: () => void): void => {
    if (!prep) return;
    const turn = ++leaveTurn.current;
    const reportFlush = (): void =>
      (onProblem ?? logPanelProblem)({
        key: 'prep:flush',
        kind: 'warning',
        icon: 'warning',
        title: '준비 변경 저장 실패',
        time: noticeTime(),
      });
    Promise.all([prep.items.flushDrafts(), prep.slides?.flush() ?? true]).then(
      results => {
        if (turn !== leaveTurn.current) return;
        if (!results.every(Boolean)) {
          reportFlush();
          return;
        }
        prep.editor.requestLeave(() => {
          if (turn !== leaveTurn.current) return;
          if (prep.slides) prep.slides.requestLeave(next);
          else next();
        });
      },
      (error: unknown) => {
        if (turn !== leaveTurn.current) return;
        console.error('Could not flush preparation edits', error);
        reportFlush();
      },
    );
  };
  const back = (): void =>
    leave(() => {
      setOtherId(null);
      prep?.editor.open(null);
    });
  const openOther = (id: string): void =>
    leave(() => {
      onOpenPrep?.(id);
      otherService.current = serviceId;
      setOtherId(id);
    });
  return {
    columns: hasDraft
      ? editorKind === 'library'
        ? [PREP_COLUMNS[0], PREP_DRAFT_COLUMNS[1], PREP_DRAFT_COLUMNS[2]]
        : PREP_DRAFT_COLUMNS
      : PREP_COLUMNS,
    partsOf: title =>
      title === SERVICE_ORDER
        ? serviceOrderParts({
            workspace: 'prep',
            navigator: hasDraft,
            onProblem,
            onOpenPrep,
            onOpenOther: openOther,
            onNavigateEditor: (id, kind) => {
              if (kind !== 'song' && kind !== 'slides') openOther(id);
              else {
                leave(() => {
                  setOtherId(null);
                  onOpenPrep?.(id);
                });
              }
            },
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
            otherEditor: otherId !== null,
            onBack: back,
            onProblem,
            sizeClass,
          }),
  };
}
