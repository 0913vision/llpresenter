import {useOtherSources} from '@renderer/features/service/items/useOtherSources';
import {EditorBackgroundDrop} from './EditorBackgroundDrop';
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
import {parseServiceItemId} from '@core/schema/ids';
import {songItemDesign} from '@renderer/features/service/items/SongItemDesign';
import type {SongEditorWindowModel} from '@renderer/features/songs/editor/useSongEditorWindow';
import {InlineSongActions} from './InlineSongActions';
import {SlideInspector} from '@renderer/features/service/slideInspector/SlideInspector';
import {SlidesInspector} from '@renderer/features/service/slideInspector/SlidesInspector';
import {OtherSlideInspector} from '@renderer/features/service/slideInspector/OtherSlideInspector';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import type {ServiceItemStore} from '@renderer/features/service/items/serviceItemStore';
import {
  SongEditor,
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
import type {SlidesEditorModel} from '@renderer/features/service/slides/useSlidesEditor';
import {isEditorEscape} from '@renderer/features/songs/editor/editorEscape';
import {SlidesBackButton} from '@renderer/features/service/slides/SlidesBackButton';
import {useShow} from '@renderer/session/show';
import headerStyles from '@renderer/features/songs/editor/SongHeader.module.css';
import styles from './OtherPrepEditor.module.css';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {isLibrarySource, openLibrarySong} from '@renderer/session/showLibrary';
import {useLeadingItemCard} from '@renderer/features/service/items/useLeadingItemCard';
import {BibleInlineEditor} from '@renderer/features/service/items/BibleInlineEditor';
import type {LeadingSlideCard} from '@renderer/features/songs/editor';
import type {ReactNode} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {AddSectionCard} from '@renderer/features/service/items/AddSectionCard';
import itemCardStyles from './ItemCardBinding.module.css';
import {hasSectionCard} from '@core/services/sectionCards';

function SlidesCardInspector({prep}: {readonly prep: PrepBinding}): ReactNode {
  const state = useSyncExternalStore(
    prep.items.subscribe,
    prep.items.getSnapshot,
  );
  const model = prep.slides?.session?.slideModel;
  const selection = useSyncExternalStore(
    model?.subscribe ?? noSubscribe,
    () => model?.getSnapshot().selection.ids.size ?? 0,
  );
  if (
    state.item !== null &&
    hasSectionCard(state.item) &&
    state.position === 0 &&
    selection === 0
  ) {
    return <OtherSlideInspector items={prep.items} editor={prep.editor} />;
  }
  return prep.slides?.session ? (
    <SlidesInspector api={prep.api} session={prep.slides.session} />
  ) : null;
}

function ItemCardBinding({
  items,
  itemId,
  children,
}: {
  readonly items: ServiceItemStore;
  readonly itemId: string | undefined;
  readonly children: (
    card: LeadingSlideCard | undefined,
    addCard: ReactNode,
  ) => ReactNode;
}): ReactNode {
  const serviceId = useShow(view => view.serviceId);
  useEffect(() => {
    if (serviceId !== null && itemId !== undefined) {
      items.show({serviceId, itemId});
    }
  }, [items, itemId, serviceId]);
  const card = useLeadingItemCard(items, itemId);
  return (
    <div className={itemCardStyles.root}>
      {children(
        card,
        itemId === undefined ? null : (
          <AddSectionCard items={items} itemId={itemId} />
        ),
      )}
    </div>
  );
}

const PREP_COLUMNS = [['라이브러리'], [SERVICE_ORDER], ['세부정보']] as const;

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
  options: {onSelectSong: (id: SongId) => void; navigating: boolean},
): PanelParts {
  return {
    embedded: (
      <LibraryPanel
        api={prep.api}
        navigating={options.navigating}
        selectionRequest={prep.selectionRequest}
        onSelectionHandled={prep.onSelectionHandled}
        onProblem={onProblem ?? ignoreProblem}
        onNewSong={prep.onNewSong}
        onSelectSong={options.onSelectSong}
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
  onSelectSong,
  sources,
}: {
  readonly sources: ReturnType<typeof useOtherSources>;
  readonly title: string;
  readonly prep: PrepBinding | undefined;
  readonly hasDraft: boolean;
  readonly otherEditor: boolean;
  readonly onBack: () => void;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly sizeClass: SizeClass;
  readonly onSelectSong: (id: SongId) => void;
}): PanelParts {
  if (!prep) return {};
  const back = onBack;
  if (title === '라이브러리') {
    return libraryParts(prep, onProblem, {onSelectSong, navigating: hasDraft});
  }
  if (title === '편집') {
    if (otherEditor) {
      return {
        embedded: (
          <EditorBackgroundDrop
            items={prep.items}
            editor={prep.editor}
            sources={sources}
          >
            <OtherPrepEditor prep={prep} sizeClass={sizeClass} onBack={back} />
          </EditorBackgroundDrop>
        ),
      };
    }
    if (prep.slides?.draft !== null && prep.slides !== undefined) {
      const slides = prep.slides;
      return {
        embedded: (
          <EditorBackgroundDrop
            items={prep.items}
            editor={prep.editor}
            sources={sources}
          >
            <ItemCardBinding
              items={prep.items}
              itemId={prep.slides.draft.snapshot.item.id}
            >
              {(card, addCard) => (
                <SlidesEditor
                  api={prep.api}
                  model={slides}
                  onBack={back}
                  leadingCard={card}
                  addCard={addCard}
                />
              )}
            </ItemCardBinding>
          </EditorBackgroundDrop>
        ),
      };
    }
    return {
      embedded: (
        <EditorBackgroundDrop
          items={prep.items}
          editor={prep.editor}
          sources={sources}
        >
          <ItemCardBinding
            items={prep.items}
            itemId={
              prep.editor.getSnapshot().session?.itemSession === true
                ? prep.editor.getSnapshot().session?.document.song.id
                : undefined
            }
          >
            {(card, addCard) => (
              <SongEditor
                store={prep.editor}
                leadingCard={card}
                addCard={addCard}
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
            )}
          </ItemCardBinding>
        </EditorBackgroundDrop>
      ),
    };
  }
  if (title === '슬라이드 속성') {
    return {
      embedded: (
        <EditorBackgroundDrop
          items={prep.items}
          editor={prep.editor}
          sources={sources}
        >
          {otherEditor ? (
            <OtherSlideInspector items={prep.items} editor={prep.editor} />
          ) : prep.slides?.session ? (
            <SlidesCardInspector prep={prep} />
          ) : (
            <SlideInspector store={prep.editor} />
          )}
        </EditorBackgroundDrop>
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
  const item = useSyncExternalStore(
    prep.items.subscribe,
    prep.items.getSnapshot,
  ).item;
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
      {item !== null && isItemOfKind(item, 'bible') ? (
        <BibleInlineEditor
          items={prep.items}
          ui={prep.api.ui}
          onBack={onBack}
          hideHeader
        />
      ) : (
        <ServiceItemPanel
          items={prep.items}
          editor={prep.editor}
          slides={prep.slides}
          sizeClass={sizeClass}
        />
      )}
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
  const selectedItem = useShow(view => view.openItemId);
  const selectionRequest = useRef(0);
  const onSelectSong = (songId: SongId): void => {
    if (prep === undefined) return;
    const request = ++selectionRequest.current;
    const previous = useShow.getState().openItemId;
    prep.api.library.showSong({songId}).then(
      song => {
        if (
          request === selectionRequest.current &&
          previous === useShow.getState().openItemId &&
          song !== null
        ) {
          openLibrarySong(song);
        }
      },
      () =>
        onProblem?.({
          key: 'details:library',
          kind: 'warning',
          icon: 'warning',
          title: '곡 불러오기 실패',
          time: noticeTime(),
        }),
    );
  };
  const selectedSong = useShow(view =>
    isLibrarySource(view, view.openItemId) ? view.librarySong.songId : null,
  );
  const parsedItem = parseServiceItemId(selectedItem);
  const selectedTarget =
    selectedSong !== null
      ? {kind: 'song' as const, songId: selectedSong}
      : parsedItem.ok
        ? {kind: 'item' as const, itemId: parsedItem.value}
        : null;
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
  const sources = useOtherSources(hasDraft);
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
        : title === '세부정보' && prep !== undefined
          ? {
              embedded: (
                <DetailsPanel
                  key={
                    selectedSong ?? (parsedItem.ok ? parsedItem.value : 'none')
                  }
                  target={selectedTarget}
                  items={prep.items}
                  editor={prep.editor}
                  api={prep.api}
                  sizeClass={sizeClass}
                  onOpenPrep={openOther}
                />
              ),
            }
          : prepPanelParts({
              title,
              prep,
              hasDraft,
              otherEditor: otherId !== null,
              onBack: back,
              onProblem,
              sizeClass,
              onSelectSong,
              sources,
            }),
  };
}
