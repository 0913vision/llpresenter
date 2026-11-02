import type {GroupedSong} from '@core/schema/groupedSong';
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
import type {LlpApi} from '@contracts/ipc/api';
import {mediaUrl} from '@contracts/ipc/mediaUrls';
import {emptyLayers} from '@core/live/state';
import type {Label} from '@core/schema/labels';
import type {ShowTile} from '@core/schema/showService';
import type {SettingsDocument} from '@core/schema/settingsDocuments';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import {DEFAULT_TEXT_STYLE} from '@core/themes/textStyle';
import {linearBlockAddress, slideCountOf} from '@core/songs/blockEdits';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
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
        (document.name !== 'themes' && document.name !== 'screens')
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
    for (const name of ['themes', 'screens'] as const) {
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
    themes: documents.find(item => item.name === 'themes')?.value,
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
  const draw = useEffectEvent(() => {
    try {
      renderer.current?.render(layers, {
        screen: appearance.screen,
        theme: appearance.theme,
      });
    } catch (error) {
      console.error('Could not update song preview', error);
    }
  });
  useLayoutEffect(() => {
    if (parent.current === null) return;
    const view = new OutputRenderer(parent.current, {
      textStyle: DEFAULT_TEXT_STYLE,
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
  }, []);
  useLayoutEffect(() => {
    draw();
  }, [layers, appearance.screen, appearance.theme]);
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

/** One 슬라이드 of a song and its place in the order the panel shows. */
export interface SongPicture {
  readonly song: GroupedSong;
  /** The 슬라이드's index in the song file. */
  readonly block: number;
  /** The next source block in the selected order; absent after its last place. */
  readonly nextBlock?: number | undefined;
  readonly background: string | undefined;
  /** The 1-based place in the shown order. */
  readonly position: number;
  readonly total: number;
}

/** A projected service tile with its local selection position. */
export interface TilePicture {
  readonly itemId: string;
  readonly tile: ShowTile;
  readonly next?: ShowTile | undefined;
  readonly position: number;
  readonly total: number;
}

/**
 * The 준비 미리보기 panel: a local picture with its item's theme,
 * never live layers, or an empty panel without a picture.
 */
export function ContentPreviewFrame({
  settings,
  labels,
  picture,
  item,
}: {
  readonly settings: LlpApi['settings'];
  readonly labels: readonly Label[];
  readonly picture: SongPicture | TilePicture | null;
  readonly item?: LiveThemeItem | undefined;
}): JSX.Element {
  const [role, setRole] = useState<PreviewRole>('main');
  const documents = usePreviewSettings(settings);
  const appearance = useMemo(() => {
    const localItem =
      item ??
      (picture !== null && 'song' in picture
        ? ({
            id: picture.song.id,
            kind: 'song',
            source: 'external',
            title: picture.song.title,
          } as const)
        : undefined);
    return previewAppearance({
      role,
      themes: documents.themes,
      screens: documents.screens,
      item:
        localItem === undefined
          ? undefined
          : {
              ...localItem,
              ...(picture === null
                ? {}
                : {slidePosition: picture.position - 1}),
            },
    });
  }, [role, documents.themes, documents.screens, item, picture]);
  const songPicture =
    picture !== null && 'song' in picture ? picture : undefined;
  const tilePicture =
    picture !== null && 'tile' in picture ? picture : undefined;
  const song = songPicture?.song;
  const block = songPicture?.block ?? 0;
  const background = songPicture?.background;
  const nextBlock = songPicture?.nextBlock;
  const layers = useMemo(
    () =>
      tilePicture !== undefined
        ? {
            ...emptyLayers(),
            slide: {
              itemId: tilePicture.itemId,
              position: tilePicture.position - 1,
              label: tilePicture.tile.label,
              lines: tilePicture.tile.lines,
              ...(tilePicture.tile.reference === undefined
                ? {}
                : {reference: tilePicture.tile.reference}),
              ...(tilePicture.next === undefined
                ? {}
                : {
                    next: {
                      label: tilePicture.next.label,
                      lines: tilePicture.next.lines,
                    },
                  }),
            },
          }
        : song === undefined
          ? emptyLayers()
          : selectedPreview(song, {block, background, nextBlock}),
    [song, block, background, nextBlock, tilePicture],
  );
  if (picture === null) {
    return (
      <Panel label="미리보기">
        <PanelHeader>
          <PanelTitle title="미리보기" />
        </PanelHeader>
      </Panel>
    );
  }
  const {position, total} = picture;
  const addr = song === undefined ? undefined : linearBlockAddress(song, block);
  const labelName =
    tilePicture !== undefined
      ? (tilePicture.tile.label ?? undefined)
      : addr?.groupName === ''
        ? undefined
        : addr?.groupName;
  const color =
    tilePicture?.tile.labelColor ??
    labels.find(label => label.name === labelName)?.color ??
    'none';
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
        <div className={styles.stage}>
          <Picture layers={layers} appearance={appearance} />
        </div>
        <div className={styles.caption}>
          {color === 'none' ? null : (
            <span
              className={styles.swatch}
              style={{background: `var(--label-${color})`}}
            />
          )}
          <span>{labelName}</span>
          <span>
            {position} / {total}
          </span>
          <span className={styles.style}>{appearance.themeName}</span>
        </div>
      </div>
    </Panel>
  );
}

export {ContentPreviewFrame as SongPreviewFrame};

/** The editor's preview: the selected block of the open song. */
export function SongPreviewPanel({
  store,
}: {
  readonly store: SongEditorStore;
}): JSX.Element {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot);
  const session = state.session;
  const snapshot = session?.history.snapshot;
  const order = session?.arrangementOrder.slides ?? [];
  const at = session?.selectedOccurrence ?? -1;
  const next = at < 0 ? undefined : order[at + 1];
  return (
    <ContentPreviewFrame
      settings={store.api.settings}
      labels={state.labels?.value.labels ?? []}
      picture={
        session === null || snapshot === undefined
          ? null
          : {
              song: snapshot.song,
              block: snapshot.selection.block,
              nextBlock: next === undefined ? undefined : next - 1,
              background: session.background,
              position: snapshot.selection.block + 1,
              total: slideCountOf(snapshot.song),
            }
      }
    />
  );
}
