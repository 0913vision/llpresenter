import {useState, useSyncExternalStore, type JSX} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {Picture} from '@renderer/features/songs/editor/SongPreview';
import {
  previewAppearance,
  selectedPreview,
} from '@renderer/features/songs/editor/songPreviewModel';
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
}): JSX.Element {
  const view = useSyncExternalStore(
    session.slideModel.subscribe,
    session.slideModel.getSnapshot,
  );
  const themes = useSettingsDocument('themes', '테마', undefined);
  const screens = useSettingsDocument('screens', '화면', undefined);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const snapshot = session.history.snapshot;
  const selected = view.slides.filter(slide =>
    view.selection.ids.has(slide.id),
  );
  const slide = snapshot.song.slides[snapshot.selection.block];
  const label = selected[0]?.label;
  const mixedLabel = selected.some(item => item.label !== label);
  const target = session.document.itemTarget;
  const appearance = previewAppearance({
    role: 'audience',
    themes: themes?.value,
    screens: screens?.value,
    item: {
      id: target?.itemId ?? snapshot.song.id,
      kind: 'song',
      source: target === undefined ? 'external' : 'service',
      title: snapshot.song.title,
      ...(session.document.itemTheme === undefined
        ? {}
        : {theme: session.document.itemTheme}),
    },
  });
  return (
    <div
      onKeyDown={event =>
        slideTransitionUndo(event, session, busy || session.readOnly)
      }
    >
      <div className={styles.picture}>
        <Picture
          layers={selectedPreview(snapshot.song, {
            block: snapshot.selection.block,
            background: session.background,
          })}
          appearance={appearance}
        />
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
