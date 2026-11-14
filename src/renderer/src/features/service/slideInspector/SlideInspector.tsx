import {useState, useSyncExternalStore, type JSX} from 'react';
import {SlidePicture} from '@renderer/rendering/SlidePicture';
import {useSongSlideAppearance} from '@renderer/features/songs/editor/useSongSlideAppearance';
import {LabelMenu} from '@renderer/features/songs/editor/LabelMenu';
import {TransitionRows} from './TransitionRows';
import {slideTransitionUndo} from '@renderer/features/songs/editor/slideTransitionSelection';
import type {SongEditorStore} from '@renderer/features/songs/editor/songEditorStore';
import {Button} from '@renderer/ui/Button';
import {labelInk} from '@renderer/ui/labelInk';
import {Panel, PanelBody} from '@renderer/ui/Panel';
import {Properties, PropertyGroup, PropertyRow} from '@renderer/ui/PropertyRow';
import styles from './SlideInspector.module.css';

/** Local inspection of the current song slide and its shared selection. */
export function SlideInspector({
  store,
}: {
  readonly store: SongEditorStore;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const session = state.session;
  return (
    <Panel label="슬라이드 속성">
      <PanelBody>
        {session === null ? null : (
          <InspectorContent
            key={session.slideDocumentId}
            store={store}
            session={session}
            busy={state.busy}
          />
        )}
      </PanelBody>
    </Panel>
  );
}

function InspectorContent({
  store,
  session,
  busy,
}: {
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
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const snapshot = session.history.snapshot;
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const slide = snapshot.song.slides[snapshot.selection.block];
  const label = selected[0]?.label;
  const mixedLabel = selected.some(item => item.label !== label);
  if (selected.length === 0) return null;
  return (
    <div
      onKeyDown={event =>
        slideTransitionUndo(event, session, busy || session.readOnly)
      }
    >
      <div className={styles.picture} data-background-picture>
        {appearance === undefined || slide === undefined ? null : (
          <SlidePicture
            {...appearance}
            slide={{
              itemId: snapshot.song.id,
              position: snapshot.selection.block,
              lines: slide.lines,
              label: slide.label ?? null,
              ...(slide.titleSlide === undefined
                ? {}
                : {titleSlide: slide.titleSlide}),
              ...(slide.titleLayout === undefined
                ? {}
                : {titleLayout: slide.titleLayout}),
              ...(slide.lyricFormat === undefined
                ? {}
                : {lyricFormat: slide.lyricFormat}),
            }}
          />
        )}
      </div>
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
      <Properties>
        <PropertyGroup>
          <PropertyRow label="이름표">
            {() => (
              <Button
                size="md"
                className={styles.full}
                disabled={busy || session.readOnly || selected.length === 0}
                onClick={event => setAnchor(event.currentTarget)}
              >
                {mixedLabel
                  ? '혼합'
                  : label === undefined || label === ''
                    ? '없음'
                    : label}
              </Button>
            )}
          </PropertyRow>
        </PropertyGroup>
        <TransitionRows session={session} disabled={busy} song />
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
                  : (slide?.hotKey ?? '설정…')}
              </Button>
            )}
          </PropertyRow>
        </PropertyGroup>
      </Properties>
      {anchor === null ? null : (
        <LabelMenu
          store={store}
          anchor={anchor}
          selected={mixedLabel ? undefined : label}
          onChoose={name => session.commandSlides({type: 'label', label: name})}
          onClose={restore => {
            setAnchor(null);
            if (restore) anchor.focus();
          }}
        />
      )}
    </div>
  );
}
