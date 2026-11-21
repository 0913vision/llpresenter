import {useState, useSyncExternalStore, type JSX} from 'react';
import type {SlideTransition} from '@core/schema/slideTransition';
import {formatSlideHotKey} from '@renderer/ui/SlideThumbnail';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {selectedPreview} from '@renderer/features/songs/editor/songPreviewModel';
import {SlideInspectorView} from './SlideInspectorView';
import {useSongSlideAppearance} from '@renderer/features/songs/editor/useSongSlideAppearance';
import {inspectorTransition, useTransitionSelection} from './TransitionSection';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {Button} from '@renderer/ui/Button';
import {labelInk} from '@renderer/ui/labelInk';
import {PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import styles from './SlideInspector.module.css';
import {SongTitleLayoutControl} from '@renderer/features/songs/editor/SongTitleLayoutControl';
import {RolePreview} from '@renderer/features/songs/editor/RolePreview';
import {usePreviewTargets} from './usePreviewTargets';
import type {Screen} from '@core/schema/screens';

function SongRolePicture({
  session,
  screen,
}: {
  readonly session: NonNullable<
    ReturnType<SongEditorStore['getSnapshot']>['session']
  >;
  readonly screen: Screen;
}): JSX.Element {
  const appearance = useSongSlideAppearance(session, screen.kind, screen.id);
  const snapshot = session.history.snapshot;
  const slide = snapshot.song.slides[snapshot.selection.block];
  return (
    <div className={styles.picture} data-background-picture>
      {appearance === undefined || slide === undefined ? null : (
        <SlidePicture
          {...appearance}
          background={slide.picture ?? appearance.background}
          songSource={{songId: snapshot.song.id, slideId: slide.id}}
          slide={
            selectedPreview(snapshot.song, {
              block: snapshot.selection.block,
              background: appearance.background,
              nextBlock:
                session.selectedOccurrence < 0
                  ? undefined
                  : session.selectedOccurrence + 1,
            }).slide ?? {
              itemId: snapshot.song.id,
              position: snapshot.selection.block,
              label: null,
              lines: [],
            }
          }
        />
      )}
    </div>
  );
}

/** Adapts the current song session to the shared inspector. */
export function SlideInspector({
  store,
  shownSession,
  cardSelected = false,
}: {
  readonly cardSelected?: boolean;
  readonly store: SongEditorStore;
  readonly shownSession?:
    ReturnType<SongEditorStore['getSnapshot']>['session'] | undefined;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const session = shownSession === undefined ? state.session : shownSession;
  return session === null ? (
    <SlideInspectorView />
  ) : (
    <InspectorContent
      key={session.slideDocumentId}
      store={store}
      session={session}
      busy={state.busy}
      cardSelected={cardSelected}
    />
  );
}

function InspectorContent({
  store,
  session,
  busy,
  cardSelected,
}: {
  readonly cardSelected: boolean;
  readonly store: SongEditorStore;
  readonly session: NonNullable<
    ReturnType<SongEditorStore['getSnapshot']>['session']
  >;
  readonly busy: boolean;
}): JSX.Element | null {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const appearance = useSongSlideAppearance(session);
  const [big, setBig] = useState<string | null>(null);
  const targets = usePreviewTargets(store.api);
  const snapshot = session.history.snapshot;
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const slide = snapshot.song.slides[snapshot.selection.block];
  const labels = [
    ...(session.itemSession && cardSelected
      ? [view.context?.cardLabel ?? undefined]
      : []),
    ...selected.map(item => item.label),
  ];
  const label = labels[0];
  const mixedLabel = labels.some(value => value !== label);
  const card =
    session.itemSession && cardSelected
      ? view.context?.cardTransition
      : undefined;
  const effects = [
    ...(card === undefined ? [] : [card ?? {kind: 'none' as const, sec: 0.5}]),
    ...selected.map(
      item => item.transition ?? {kind: 'none' as const, sec: 0.5},
    ),
  ];
  const {value: effect, mixed: mixedEffect} = inspectorTransition(effects);
  const transition = useTransitionSelection({
    session,
    disabled: busy,
    onApplyAll: session.itemSession
      ? value => session.changeItemTransitions(value, true, true)
      : undefined,
  });

  if (selected.length === 0) return <SlideInspectorView />;
  return (
    <SlideInspectorView
      identity={`${session.slideDocumentId}:${snapshot.selection.block}:${selected.map(item => item.id).join(',')}:${cardSelected}`}
      pending={
        targets.loading || appearance === undefined || slide === undefined
      }
      waitForPicture={targets.screens.length > 0}
      pictureCount={targets.screens.length}
      preview={
        <>
          <RolePreview
            screens={targets.screens}
            big={big}
            onBigChange={setBig}
            naturalHeight
            renderScreen={screen => (
              <SongRolePicture session={session} screen={screen} />
            )}
          />
          <div
            className={styles.caption}
            style={labelInk(
              store
                .getSnapshot()
                .labels?.value.labels.find(entry => entry.name === slide?.label)
                ?.color ?? 'none',
            )}
          >
            {slide?.label ?? ''}
            <span>
              {snapshot.selection.block + 1} / {view.slides.length}
            </span>
          </div>
        </>
      }
      beforeProperties={
        <SongTitleLayoutControl session={session} disabled={busy} />
      }
      afterProperties={
        <PropertyGroup>
          <PropertyRow label="단축키">
            {() => (
              <Button
                size="md"
                className={styles.full}
                disabled={busy || session.readOnly || selected.length !== 1}
                onClick={() => store.requestAction('hot-key')}
              >
                {selected.length > 1
                  ? '여러 슬라이드'
                  : slide?.hotKey === undefined
                    ? '설정…'
                    : formatSlideHotKey(slide.hotKey)}
              </Button>
            )}
          </PropertyRow>
        </PropertyGroup>
      }
      adapter={{
        selectedIds: [
          ...(card === undefined ? [] : ['card']),
          ...selected.map(item => item.id),
        ],
        label: {
          store,
          associateControl: false,
          value: label,
          mixed: mixedLabel,
          disabled: busy || session.readOnly || selected.length === 0,
          change: name =>
            session.itemSession && cardSelected
              ? session.changeItemLabels(name, true)
              : session.commandSlides({type: 'label', label: name}),
        },
        transition:
          card === undefined
            ? transition
            : {
                value: effect,
                mixed: mixedEffect,
                disabled: busy || session.readOnly,
                selectionKey: selected.map(item => item.id).join(','),
                onChange: (value: SlideTransition) =>
                  session.changeItemTransitions(value, true),
                onSeconds: (seconds: number) =>
                  session.changeItemTransitions(seconds, true),
                onApplyAll: () =>
                  session.changeItemTransitions(effect, true, true),
              },
        undo: action => session.edit(action),
        undoDisabled: busy || session.readOnly,
      }}
    />
  );
}
