import {
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type JSX,
} from 'react';
import type {LlpApi} from '@shared/ipc';
import {mediaUrl} from '@shared/media';
import type {SettingsDocument} from '@shared/schema/settingsDocuments';
import {OutputRenderer} from '@renderer/render/outputRenderer';
import {Panel, PanelHeader, PanelTitle} from '@renderer/ui/Panel';
import {SegmentedControl} from '@renderer/ui/SegmentedControl';
import {
  PREVIEW_ROLES,
  previewAppearance,
  selectedPreview,
  type PreviewRole,
} from './songPreviewModel';
import type {SongEditorStore} from './songEditorStore';
import styles from './SongPanels.module.css';

function usePreviewSettings(api: LlpApi['settings']) {
  const [documents, setDocuments] = useState<readonly SettingsDocument[]>([]);
  useEffect(() => {
    let alive = true;
    const accept = (document: SettingsDocument): void => {
      if (
        !alive ||
        (document.name !== 'looks' && document.name !== 'screens')
      ) {
        return;
      }
      setDocuments(current => {
        if (
          (current.find(item => item.name === document.name)?.revision ?? -1) >=
          document.revision
        ) {
          return current;
        }
        return [
          ...current.filter(item => item.name !== document.name),
          document,
        ];
      });
    };
    const stop = api.subscribe(accept);
    for (const name of ['looks', 'screens'] as const) {
      void api.get({name}).then(accept, (error: unknown) => {
        if (alive) console.error('Could not read song preview settings', error);
      });
    }
    return () => {
      alive = false;
      stop();
    };
  }, [api]);
  return {
    looks: documents.find(item => item.name === 'looks')?.value,
    screens: documents.find(item => item.name === 'screens')?.value,
  };
}

interface ScreenStyle extends CSSProperties {
  readonly '--output-background': string;
}
function Picture({
  layers,
  appearance,
}: {
  readonly layers: ReturnType<typeof selectedPreview>;
  readonly appearance: ReturnType<typeof previewAppearance>;
}): JSX.Element {
  const parent = useRef<HTMLDivElement>(null);
  const renderer = useRef<OutputRenderer | null>(null);
  const draw = useEffectEvent(() =>
    renderer.current?.render(layers, {screen: appearance.screen}),
  );
  useLayoutEffect(() => {
    if (parent.current === null) return;
    // TODO(0913vision): Draw the stage layout on the 무대 화면 once the
    // renderer has a stage layout engine; until then it shows the lyric layer.
    const view = new OutputRenderer(parent.current, {
      lyricStyle: appearance.style,
      mediaUrl,
      mode: 'preview',
      onError: (message, error) => console.error(message, error),
    });
    renderer.current = view;
    draw();
    return () => {
      renderer.current = null;
      view.dispose();
    };
  }, [appearance.style]);
  useLayoutEffect(() => {
    draw();
  }, [layers, appearance.screen]);
  const style: ScreenStyle = {'--output-background': appearance.background};
  return (
    <div
      ref={parent}
      className={styles.screen}
      style={style}
      data-checker={appearance.checker || undefined}
    />
  );
}

/** Prep draws a local selection with current Look styling, never live layers. */
export function SongPreviewPanel({
  store,
}: {
  readonly store: SongEditorStore;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const [role, setRole] = useState<PreviewRole>('main');
  const settings = usePreviewSettings(store.api.settings);
  const appearance = useMemo(
    () => previewAppearance(role, settings.looks, settings.screens),
    [role, settings.looks, settings.screens],
  );
  const session = state.session;
  if (session === null) {
    return (
      <Panel label="미리보기">
        <PanelHeader>
          <PanelTitle title="미리보기" />
        </PanelHeader>
      </Panel>
    );
  }
  const {song, selection} = session.history.snapshot;
  const layers = selectedPreview(
    song,
    {block: selection.block, background: session.background},
    appearance,
  );
  const slide = song.slides[selection.block];
  const color =
    state.labels?.value.labels.find(label => label.name === slide?.label)
      ?.color ?? 'none';
  return (
    <Panel label="미리보기">
      <PanelHeader>
        <PanelTitle title="미리보기" />
        <SegmentedControl
          className={styles.tabs}
          label="미리보기 화면"
          options={PREVIEW_ROLES}
          value={role}
          onChange={setRole}
        />
      </PanelHeader>
      <div className={styles.previewBody}>
        <Picture layers={layers} appearance={appearance} />
        <div className={styles.caption}>
          {color === 'none' ? null : (
            <span
              className={styles.swatch}
              style={{background: `var(--label-${color})`}}
            />
          )}
          <span>{slide?.label}</span>
          <span>
            {selection.block + 1} / {song.slides.length}
          </span>
          <span className={styles.style}>{appearance.styleName}</span>
        </div>
      </div>
    </Panel>
  );
}
