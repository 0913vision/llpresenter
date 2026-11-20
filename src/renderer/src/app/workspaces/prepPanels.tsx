import {useOtherSources} from '@renderer/features/service/items/useOtherSources';
import {followPrepOpenFailures} from '../prepOpenFailure';
import {EditorBackgroundDrop} from './EditorBackgroundDrop';
import {EditorItemSettings} from './EditorItemSettings';
import {PrepPalette} from '@renderer/features/service/items/PrepPalette';
import {
  useEffect,
  useDeferredValue,
  useLayoutEffect,
  useMemo,
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
import {SermonInlineEditor} from '@renderer/features/service/items/SermonInlineEditor';
import {ServiceItemPanel} from '@renderer/features/service/items/SongItemPanel';
import type {
  ServiceItemStore,
  ServiceItemState,
} from '@renderer/features/service/items/serviceItemStore';
import type {SongSession} from '@renderer/features/songs/editor/songSession';
import type {SlidesListSession} from '@renderer/features/service/slides/slidesListSession';
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
import {LiturgyEditor} from '@renderer/features/service/items/LiturgyEditor';
import {useShow} from '@renderer/session/show';
import headerStyles from '@renderer/features/songs/editor/SongHeader.module.css';
import styles from './OtherPrepEditor.module.css';
import {DetailsPanel} from '@renderer/features/service/details/DetailsPanel';
import {isLibrarySource, openLibrarySong} from '@renderer/session/showLibrary';
import {useLeadingItemCard} from '@renderer/features/service/items/useLeadingItemCard';
import {PrepBibleSplitTools} from './PrepBibleSplitTools';
import {BibleInlineEditor} from '@renderer/features/service/items/BibleInlineEditor';
import {
  SlideTextEditor,
  SlideTextFields,
} from '@renderer/features/service/items/SlideTextFields';
import {itemEditorAdapter} from '@renderer/platform/itemEditorAdapter';
import type {LeadingSlideCard} from '@renderer/features/songs/editor';
import type {ReactNode} from 'react';
import {isItemOfKind} from '@core/schema/service';
import {AddSectionCard} from '@renderer/features/service/items/AddSectionCard';
import itemCardStyles from './ItemCardBinding.module.css';
import {hasSectionCard} from '@core/services/sectionCards';
import type {SlideTransition} from '@core/schema/slideTransition';
import {LITURGY} from '@core/services/liturgy';
import {displayReference} from '@core/bible/displayReference';
import {pictures} from '@renderer/rendering/pictures/pictureService';

function SlidesCardInspector({
  prep,
  session,
  state,
}: {
  readonly prep: PrepBinding;
  readonly session: SlidesListSession;
  readonly state: ServiceItemState;
}): ReactNode {
  const model = session.slideModel;
  const selection = useSyncExternalStore(model.subscribe, model.getSnapshot)
    .selection.ids.size;
  const applyAll = (transition: SlideTransition): void => {
    if (session.readOnly) return;
    const item = session.draft.snapshot.item;
    session.draft.change(
      {
        ...item,
        ...(item.sectionCard === undefined
          ? {}
          : {sectionCard: {...item.sectionCard, transition}}),
        slides: {
          ...item.slides,
          slides: item.slides.slides.map(slide => ({...slide, transition})),
        },
      },
      session.draft.snapshot.selected,
      'transition-all',
    );
    session.draft.endTyping();
  };
  if (
    state.item !== null &&
    hasSectionCard(state.item) &&
    state.position === 0 &&
    selection === 0
  ) {
    return (
      <OtherSlideInspector
        items={prep.items}
        editor={prep.editor}
        shownItem={state}
        applyAll={applyAll}
        replayDraft={action => session.edit(action)}
        cardLabel={session.draft.snapshot.item.sectionCard?.label ?? null}
        changeLabel={name => {
          const item = session.draft.snapshot.item;
          if (item.sectionCard === undefined || session.readOnly) return;
          const {label: _label, ...card} = item.sectionCard;
          session.draft.change(
            {
              ...item,
              sectionCard: {
                ...card,
                ...(name === undefined ? {} : {label: name}),
              },
            },
            session.draft.snapshot.selected,
            'label-selected',
          );
          session.draft.endTyping();
        }}
      />
    );
  }
  return (
    <SlidesInspector
      api={prep.api}
      session={session}
      store={prep.editor}
      onApplyAll={applyAll}
      cardSelected={state.cardSelected}
    />
  );
}

function SongCardInspector({
  prep,
  session,
  itemState,
}: {
  readonly prep: PrepBinding;
  readonly session: SongSession;
  readonly itemState: ServiceItemState;
}): ReactNode {
  const model = session.slideModel;
  const selection = useSyncExternalStore(model.subscribe, model.getSnapshot)
    .selection.ids.size;
  if (
    session.itemSession &&
    itemState.item !== null &&
    hasSectionCard(itemState.item) &&
    itemState.cardSelected &&
    selection === 0
  ) {
    return (
      <OtherSlideInspector
        items={prep.items}
        editor={prep.editor}
        shownItem={itemState}
        replayDraft={action => session.edit(action)}
        cardLabel={session.slideModel.getSnapshot().context?.cardLabel ?? null}
        changeLabel={name => session.changeItemLabels(name, true)}
        cardTransition={
          session.slideModel.getSnapshot().context?.cardTransition
        }
        changeSelected={change => session.changeItemTransitions(change, true)}
        applyAll={transition =>
          session.changeItemTransitions(transition, true, true)
        }
      />
    );
  }
  return (
    <SlideInspector
      store={prep.editor}
      shownSession={session}
      cardSelected={itemState.cardSelected}
    />
  );
}

function ItemCardBinding({
  items,
  itemId,
  shownItem,
  children,
}: {
  readonly items: ServiceItemStore;
  readonly itemId: string | undefined;
  readonly shownItem: ServiceItemState | null;
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
  const card = useLeadingItemCard(items, itemId, {
    shownItem: shownItem ?? undefined,
    themeTextEditing: shownItem !== null,
  });
  return (
    <div className={itemCardStyles.root}>
      {children(
        card,
        itemId === undefined ? null : (
          <AddSectionCard
            items={items}
            itemId={itemId}
            shownItem={shownItem ?? undefined}
          />
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
      <LibraryOrPalette showPalette={!options.navigating}>
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
      </LibraryOrPalette>
    ),
  };
}

function LibraryOrPalette({
  showPalette,
  children,
}: {
  readonly showPalette: boolean;
  readonly children: React.ReactNode;
}) {
  const [tab, setTab] = useState<'elements' | 'songs'>('elements');
  return (
    <PrepPalette
      library={children}
      tab={tab}
      onTabChange={setTab}
      navigating={!showPalette}
    />
  );
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
  songSession,
  slidesSession,
  itemState,
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
  readonly songSession: SongSession | null;
  readonly slidesSession: SlidesListSession | null;
  readonly itemState: ServiceItemState | null;
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
            shownSession={songSession}
            shownItem={itemState}
          >
            {itemState === null ? null : (
              <OtherPrepEditor
                prep={prep}
                itemState={itemState}
                sizeClass={sizeClass}
                onBack={back}
              />
            )}
          </EditorBackgroundDrop>
        ),
      };
    }
    if (slidesSession !== null && prep.slides !== undefined) {
      const slides = {
        ...prep.slides,
        session: slidesSession,
        draft: slidesSession.draft,
      };
      return {
        embedded: (
          <EditorBackgroundDrop
            items={prep.items}
            editor={prep.editor}
            sources={sources}
            shownSession={songSession}
            shownItem={itemState}
          >
            <ItemCardBinding
              items={prep.items}
              itemId={slidesSession.draft.snapshot.item.id}
              shownItem={itemState}
            >
              {(card, addCard) => (
                <SlidesEditor
                  api={prep.api}
                  store={prep.editor}
                  model={slides}
                  onBack={back}
                  leadingCard={card}
                  addCard={addCard}
                  renderTextFields={
                    itemState === null
                      ? undefined
                      : index => (
                          <SlideTextFields
                            items={prep.items}
                            state={itemState}
                            position={itemState.cardSelected ? 0 : index}
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
    return {
      embedded: (
        <EditorBackgroundDrop
          items={prep.items}
          editor={prep.editor}
          sources={sources}
          shownSession={songSession}
          shownItem={itemState}
        >
          <ItemCardBinding
            items={prep.items}
            shownItem={itemState}
            itemId={
              songSession?.itemSession === true
                ? songSession.document.song.id
                : undefined
            }
          >
            {(card, addCard) => (
              <SongEditor
                store={prep.editor}
                shownSession={songSession}
                leadingCard={card}
                addCard={addCard}
                textOverrides={itemState?.item?.textOverrides}
                renderTextFields={
                  itemState === null || songSession?.itemSession !== true
                    ? undefined
                    : index => (
                        <SlideTextFields
                          items={prep.items}
                          state={itemState}
                          position={itemState.cardSelected ? 0 : index}
                        />
                      )
                }
                ui={prep.api.ui}
                renderDesign={songItemDesign(prep.api, prep.items)}
                onImportedSave={prep.onImportedSave}
                onBack={back}
                actions={
                  prep.controls === undefined ? null : (
                    <InlineSongActions
                      store={prep.editor}
                      shownSession={songSession}
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
          shownSession={songSession}
          shownItem={itemState}
        >
          <div className={styles.inspector}>
            <EditorItemSettings
              items={prep.items}
              editor={prep.editor}
              shownItem={itemState ?? undefined}
              shownSession={songSession}
              flushSlides={() => prep.slides?.flush() ?? Promise.resolve(true)}
            />
            {itemState?.item &&
            (isItemOfKind(itemState.item, 'bible') ||
              isItemOfKind(itemState.item, 'sermon')) ? (
              <SlideTextFields items={prep.items} state={itemState} />
            ) : null}
            {otherEditor ? (
              <OtherSlideInspector
                items={prep.items}
                editor={prep.editor}
                shownItem={itemState ?? undefined}
              />
            ) : slidesSession && itemState ? (
              <SlidesCardInspector
                prep={prep}
                session={slidesSession}
                state={itemState}
              />
            ) : songSession?.itemSession && itemState ? (
              <SongCardInspector
                prep={prep}
                session={songSession}
                itemState={itemState}
              />
            ) : (
              <SlideInspector store={prep.editor} shownSession={songSession} />
            )}
          </div>
        </EditorBackgroundDrop>
      ),
    };
  }
  return {};
}

function OtherPrepEditor({
  prep,
  itemState,
  sizeClass,
  onBack,
}: {
  readonly prep: PrepBinding;
  readonly itemState: ServiceItemState;
  readonly sizeClass: SizeClass;
  readonly onBack: () => void;
}) {
  const itemId = itemState.item?.id;
  const serviceId = itemState.service?.service.id;
  useEffect(() => {
    const current = useShow.getState();
    if (
      itemId !== undefined &&
      serviceId !== undefined &&
      current.serviceId === serviceId &&
      current.openItemId === itemId
    ) {
      prep.items.show({serviceId, itemId});
    }
  }, [prep.items, itemId, serviceId]);
  const serviceName = useShow(view => view.serviceName);
  const item = itemState.item;
  const [manualSplitRequest, setManualSplitRequest] = useState(0);
  const splitVerses = item !== null && itemEditorAdapter(item).splitVerses;
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
        {item === null ? null : isItemOfKind(item, 'liturgy') ? (
          <strong>{LITURGY[item.liturgy.kind].name}</strong>
        ) : isItemOfKind(item, 'bible') ? (
          <strong>{displayReference(item.bible.ref)}</strong>
        ) : isItemOfKind(item, 'sermon') ? (
          <strong>{displayReference(item.sermon.passage.ref)}</strong>
        ) : null}
      </header>
      {item !== null && isItemOfKind(item, 'liturgy') ? (
        <SlideTextFields items={prep.items} state={itemState} />
      ) : null}
      {item !== null && isItemOfKind(item, 'sermon') ? (
        <SermonInlineEditor
          items={prep.items}
          shownItem={itemState}
          showSourceTitle={false}
        />
      ) : null}
      {item !== null &&
      (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon')) ? (
        <PrepBibleSplitTools
          item={item}
          selectedIndex={itemState.position}
          manualRequest={manualSplitRequest}
          onProblem={prep.items.reportNotice}
        />
      ) : null}
      {item !== null && isItemOfKind(item, 'liturgy') ? (
        <LiturgyEditor
          items={prep.items}
          shownItem={itemState}
          ui={prep.api.ui}
          themeTextEditing
        />
      ) : item !== null &&
        (isItemOfKind(item, 'bible') || isItemOfKind(item, 'sermon')) ? (
        <SlideTextEditor items={prep.items} state={itemState}>
          {renderFields => (
            <BibleInlineEditor
              items={prep.items}
              shownItem={itemState}
              ui={prep.api.ui}
              onBack={onBack}
              hideHeader
              renderTextFields={renderFields}
              onSplit={
                splitVerses
                  ? () => setManualSplitRequest(value => value + 1)
                  : undefined
              }
            />
          )}
        </SlideTextEditor>
      ) : item !== null &&
        (isItemOfKind(item, 'song') || isItemOfKind(item, 'slides')) ? null : (
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
  selectedItem: retainedItem,
  sizeClass,
  onProblem,
  onOpenPrep,
  onShowInLibrary,
}: {
  readonly prep: PrepBinding | undefined;
  readonly selectedItem?: string | null | undefined;
  readonly sizeClass: SizeClass;
  readonly onProblem: ((notice: Notice) => void) | undefined;
  readonly onOpenPrep: ((itemId: string) => void) | undefined;
  readonly onShowInLibrary: ((songId: SongId) => void) | undefined;
}): WorkspacePanels {
  const [otherId, setOtherId] = useState<string | null>(null);
  const [switching, setSwitching] = useState<{
    readonly editor: SongSession | null;
    readonly slides: SlidesListSession | null;
    readonly closed: boolean;
    readonly itemId: string;
  } | null>(null);
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
  const requestedItem = useShow(view => view.openItemId);
  const selectedItem =
    retainedItem === undefined ? requestedItem : retainedItem;
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
    isLibrarySource(view, selectedItem) ? view.librarySong.songId : null,
  );
  const parsedItem = parseServiceItemId(selectedItem);
  const selectedTarget =
    selectedSong !== null
      ? {kind: 'song' as const, songId: selectedSong}
      : parsedItem.ok
        ? {kind: 'item' as const, itemId: parsedItem.value}
        : null;
  const editorSession = useSyncExternalStore(
    prep?.editor.subscribe ?? noSubscribe,
    () => prep?.editor.getSnapshot().session ?? null,
  );
  const slidesDraft = prep?.slides?.draft ?? null;
  const slidesSession = prep?.slides?.session ?? null;
  const itemState = useSyncExternalStore(
    prep?.items.subscribe ?? noSubscribe,
    () => prep?.items.getSnapshot() ?? null,
  );
  const [itemSnapshots, setItemSnapshots] = useState(
    () => new Map<string, ServiceItemState>(),
  );
  const currentItemId = itemState?.item?.id;
  if (
    currentItemId !== undefined &&
    itemState !== null &&
    itemSnapshots.get(currentItemId) !== itemState
  ) {
    const next = new Map(itemSnapshots);
    next.set(currentItemId, itemState);
    if (next.size > 16) {
      const oldest = next.keys().next().value;
      if (oldest !== undefined) next.delete(oldest);
    }
    setItemSnapshots(next);
  }
  const waitingForEditor =
    switching !== null &&
    editorSession === null &&
    slidesSession === null &&
    otherId === null;
  const requestedEditor = waitingForEditor ? switching.editor : editorSession;
  const requestedSlides = waitingForEditor ? switching.slides : slidesSession;
  const frameItemId =
    otherId ??
    requestedSlides?.draft.snapshot.item.id ??
    (requestedEditor?.itemSession ? requestedEditor.document.song.id : null);
  const retainedState =
    frameItemId === null ? undefined : itemSnapshots.get(frameItemId);
  const frameItem =
    frameItemId !== null && currentItemId !== frameItemId
      ? retainedState?.service?.service.id === serviceId
        ? retainedState
        : null
      : itemState;
  const requestedFrame = useMemo(
    () => ({
      editorSession: requestedEditor,
      slidesSession: requestedSlides,
      otherId,
      itemState: frameItem,
    }),
    [requestedEditor, requestedSlides, otherId, frameItem],
  );
  const deferred = useDeferredValue(requestedFrame);
  // NOTE(0913vision): With no drawing room, pictures draw in place and no
  // background preparation can delay the frame.
  const shown = pictures.drawInPlace ? requestedFrame : deferred;
  const editorKind =
    shown.editorSession === null
      ? 'table'
      : shown.editorSession.itemSession
        ? 'item'
        : 'library';
  useEffect(
    () =>
      followPrepOpenFailures(itemId => {
        setSwitching(current => (current?.itemId === itemId ? null : current));
      }),
    [],
  );
  const switchingId = switching?.itemId;
  useEffect(() => {
    if (switchingId === undefined) return undefined;
    const timer = setTimeout(() => {
      if (
        prep?.editor.getSnapshot().session == null &&
        prep?.slides?.draft == null &&
        otherId === null
      ) {
        setSwitching(current =>
          current?.itemId === switchingId ? null : current,
        );
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [switchingId, prep, otherId]);
  const hasDraft =
    editorKind !== 'table' ||
    shown.slidesSession !== null ||
    shown.otherId !== null ||
    switching !== null;
  if (
    switching !== null &&
    ((editorSession !== null &&
      (switching.closed || editorSession !== switching.editor)) ||
      (slidesSession !== null &&
        (switching.closed || slidesSession !== switching.slides)) ||
      (otherId !== null &&
        switching.editor === null &&
        switching.slides === null &&
        switching.closed))
  ) {
    setSwitching(null);
    setOtherId(null);
  } else if (
    switching !== null &&
    !switching.closed &&
    editorSession === null &&
    slidesDraft === null &&
    otherId === null
  ) {
    setSwitching({...switching, closed: true});
  }
  const sources = useOtherSources(hasDraft);
  const origin = useRef<{id: string; library: boolean} | null>(null);
  useLayoutEffect(() => {
    const slides = shown.slidesSession?.draft;
    if (hasDraft) {
      const id =
        shown.otherId ??
        slides?.snapshot.item.id ??
        shown.editorSession?.document.song.id ??
        null;
      if (id !== null) {
        origin.current = {id, library: editorKind === 'library'};
      }
      return;
    }
    const previous = origin.current;
    origin.current = null;
    if (previous === null) return;
    const label = previous.library ? '라이브러리 곡' : '예배 순서';
    // NOTE(0913vision): The kept 진행 list is inert and hidden; focus goes to
    // the one on screen.
    const list = [
      ...document.querySelectorAll<HTMLElement>(
        `[data-workspace-layout="prep"] [role="listbox"][aria-label="${label}"]`,
      ),
    ].find(element => element.closest('[inert]') === null);
    const row =
      list?.querySelector<HTMLElement>(`[data-value="${previous.id}"]`) ??
      list?.querySelector<HTMLElement>('[aria-selected="true"]');
    row?.focus({preventScroll: true});
    row?.scrollIntoView({block: 'nearest'});
  }, [hasDraft, shown, editorKind]);
  const leave = (next: () => void, keepSlides = false): void => {
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
          if (prep.slides && !keepSlides) prep.slides.requestLeave(next);
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
      setSwitching(null);
      setOtherId(null);
      prep?.editor.open(null);
    });
  const openOther = (id: string): void =>
    leave(() => {
      onOpenPrep?.(id);
      otherService.current = serviceId;
      setOtherId(id);
    });
  const shownItem =
    shown.otherId ??
    shown.slidesSession?.draft.snapshot.item.id ??
    (editorKind === 'item'
      ? (shown.editorSession?.document.song.id ?? null)
      : null);
  return {
    shownItem: hasDraft && editorKind !== 'library' ? shownItem : selectedItem,
    pictureIdentity: hasDraft
      ? `edit:${editorKind}:${shownItem ?? shown.editorSession?.document.song.id ?? ''}`
      : 'table',
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
              const row = useShow
                .getState()
                .rows.find(value => value.id === id);
              if (
                (row?.kind === 'slides' && row.liturgy !== undefined) ||
                (kind !== 'song' && kind !== 'slides')
              ) {
                openOther(id);
              } else {
                leave(() => {
                  setSwitching({
                    editor: editorSession,
                    slides: slidesSession,
                    closed: false,
                    itemId: id,
                  });
                  onOpenPrep?.(id);
                }, true);
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
              otherEditor: shown.otherId !== null,
              songSession: shown.editorSession,
              slidesSession: shown.slidesSession,
              itemState: shown.itemState,
              onBack: back,
              onProblem,
              sizeClass,
              onSelectSong,
              sources,
            }),
  };
}
