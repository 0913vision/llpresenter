import {labelInk} from '@renderer/ui/labelInk';
import type {Song} from '@core/schema/song';
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
import {slideCountOf} from '@core/songs/blockEdits';
import {OutputRenderer} from '@renderer/rendering/outputRenderer';
import {openPreviewMedia} from '@renderer/rendering/previewMedia';
import {RolePreview} from './RolePreview';
import {
  previewAppearance,
  selectedPreview,
  type PreviewRole,
} from './songPreviewModel';
import type {SongEditorStore} from './songEditorStore';
import styles from './SongPanels.module.css';
import type {LiveLayers} from '@core/live/state';
import type {SlideTransition} from '@core/schema/slideTransition';
import {
  defaultPreferences,
  withPreferenceDefaults,
} from '@core/schema/preferences';
import {transitionTimes} from '@core/output/transitions';
import {SlidePreviewPlayback} from './slidePreviewPlayback';

function usePreviewSettings(api: LlpApi['settings']) {
  const [documents, setDocuments] = useState<readonly SettingsDocument[]>([]);
  useEffect(() => {
    let alive = true;
    const accept = (document: SettingsDocument): void => {
      if (
        !alive ||
        (document.name !== 'themes' &&
          document.name !== 'screens' &&
          document.name !== 'preferences')
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
    for (const name of ['themes', 'screens', 'preferences'] as const) {
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
    preferences: documents.find(item => item.name === 'preferences')?.value,
  };
}

interface ScreenStyle extends CSSProperties {
  readonly '--output-background': string;
}
export function Picture({
  layers,
  appearance,
  animate = true,
  transition,
  before,
}: {
  readonly layers: ReturnType<typeof selectedPreview>;
  readonly appearance: ReturnType<typeof previewAppearance>;
  readonly animate?: boolean;
  readonly transition?: SlideTransition | undefined;
  readonly before?: LiveLayers | undefined;
}): JSX.Element {
  const parent = useRef<HTMLDivElement>(null);
  const playback = useRef<SlidePreviewPlayback | null>(null);
  const draw = useEffectEvent(() => {
    try {
      playback.current?.render(
        layers,
        {
          screen: appearance.screen,
          theme: appearance.theme,
          transitions: animate,
          ...(layers.slide === null ? {} : {slide: layers.slide}),
          ...(transition === undefined
            ? {}
            : {
                slideTransition: transition,
                transitionTimes: transitionTimes(
                  defaultPreferences,
                  transition,
                ),
              }),
        },
        before,
      );
    } catch (error) {
      console.error('Could not update song preview', error);
    }
  });
  useLayoutEffect(() => {
    if (parent.current === null) return;
    const previewMedia = openPreviewMedia(window.llp);
    const view = new OutputRenderer(parent.current, {
      textStyle: DEFAULT_TEXT_STYLE,
      mediaUrl,
      previewMedia,
      mode: 'preview',
      onError: (message, error) => console.error(message, error),
    });
    playback.current = new SlidePreviewPlayback((layers, frame) =>
      view.render(layers, frame),
    );
    draw();
    return () => {
      playback.current?.dispose();
      playback.current = null;
      view.dispose();
      previewMedia?.dispose();
    };
  }, []);
  useLayoutEffect(() => {
    draw();
  }, [
    layers,
    appearance.screen,
    appearance.theme,
    animate,
    transition,
    before,
  ]);
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
  readonly song: Song;
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

/** A 영상 or 그림 item: its file shown as the background, with its name below. */
export interface MediaPicture {
  readonly itemId: string;
  readonly mediaId: string;
  readonly name: string;
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
  readonly picture: SongPicture | TilePicture | MediaPicture | null;
  readonly item?: LiveThemeItem | undefined;
}): JSX.Element {
  const [role, setRole] = useState<PreviewRole>('audience');
  const documents = usePreviewSettings(settings);
  const appearances = useMemo(() => {
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
    const appearanceOf = (of: PreviewRole) =>
      previewAppearance({
        role: of,
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
    return {
      audience: appearanceOf('audience'),
      stage: appearanceOf('stage'),
      broadcast: appearanceOf('broadcast'),
    };
  }, [documents.themes, documents.screens, item, picture]);
  const appearance = appearances[role];
  const songPicture =
    picture !== null && 'song' in picture ? picture : undefined;
  const tilePicture =
    picture !== null && 'tile' in picture ? picture : undefined;
  const mediaPicture =
    picture !== null && 'mediaId' in picture ? picture : undefined;
  const song = songPicture?.song;
  const block = songPicture?.block ?? 0;
  const background = songPicture?.background;
  const nextBlock = songPicture?.nextBlock;
  const layers = useMemo(
    () =>
      mediaPicture !== undefined
        ? {
            ...emptyLayers(),
            media: {
              mediaId: mediaPicture.mediaId,
              loop: true,
              startedAt: 0,
              itemId: mediaPicture.itemId,
            },
          }
        : tilePicture !== undefined
          ? {
              ...emptyLayers(),
              slide: {
                itemId: tilePicture.itemId,
                position: tilePicture.position - 1,
                label: tilePicture.tile.label,
                lines: tilePicture.tile.lines,
                ...(tilePicture.tile.titleSlide === undefined
                  ? {}
                  : {titleSlide: tilePicture.tile.titleSlide}),
                ...(tilePicture.tile.titleLayout === undefined
                  ? {}
                  : {titleLayout: tilePicture.tile.titleLayout}),
                ...(tilePicture.tile.transition === undefined
                  ? {}
                  : {transition: tilePicture.tile.transition}),
                ...(tilePicture.tile.biblePart === undefined
                  ? {}
                  : {biblePart: tilePicture.tile.biblePart}),
                ...(tilePicture.tile.continued === undefined
                  ? {}
                  : {continued: tilePicture.tile.continued}),
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
    [song, block, background, nextBlock, tilePicture, mediaPicture],
  );
  const defaults =
    documents.preferences === undefined
      ? defaultPreferences
      : withPreferenceDefaults(documents.preferences);
  const transition =
    layers.slide?.transition ??
    defaults.output.transition[
      (picture?.position ?? 1) === 1 ? 'between' : 'within'
    ];
  const before = useMemo(
    () =>
      song === undefined || block === 0
        ? {...layers, slide: null}
        : selectedPreview(song, {
            block: block - 1,
            background,
            nextBlock: block,
          }),
    [song, block, background, layers],
  );
  // NOTE(0913vision): With nothing to show (no item, or a 구역 selected) the
  // panel keeps its full-width stage and the height of its caption, blank (no
  // theme content is drawn), so the column below does not move
  // when the selection changes from one item to another.
  const {position, total} = picture ?? {position: 0, total: 0};
  const addr = song === undefined ? undefined : song.slides[block];
  const labelName =
    mediaPicture !== undefined
      ? mediaPicture.name
      : tilePicture !== undefined
        ? (tilePicture.tile.label ?? undefined)
        : addr?.label === ''
          ? undefined
          : addr?.label;
  const color =
    tilePicture?.tile.labelColor ??
    labels.find(label => label.name === labelName)?.color ??
    'none';
  return (
    <RolePreview
      big={role}
      onBigChange={setRole}
      blank={picture === null}
      renderRole={shown =>
        picture === null ? (
          <div className={styles.screen} data-blank="" />
        ) : (
          <Picture
            layers={layers}
            appearance={appearances[shown]}
            transition={transition}
            before={before}
          />
        )
      }
      caption={() => (
        <>
          {color === 'none' ? null : (
            <span
              className={styles.swatch}
              style={{background: labelInk(color)['--label-fill']}}
            />
          )}
          <span>{labelName}</span>
          <span>
            {position} / {total}
          </span>
          <span className={styles.style}>{appearance.themeName}</span>
        </>
      )}
    />
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
  const order =
    session?.history.snapshot.song.slides.map((_, index) => index + 1) ?? [];
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
