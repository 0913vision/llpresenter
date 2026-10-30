import {emptyLayers, type LiveLayers} from '@core/live/state';
import {STARTER_SCREEN_IDS, resolveOutputScreen} from '@core/screens/screens';
import {screenIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {LooksFile} from '@core/schema/looks';
import type {ScreensFile} from '@core/schema/screens';
import type {RenderScreen} from '@renderer/rendering/layer';
import {DEFAULT_LYRIC_STYLE} from '@core/looks/lyricStyle';
import {resolveScreenLook, showsLayer} from '@core/looks/screenLook';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import {linearBlockAddress, linearSlidesOf} from '@core/songs/blockEdits';

export const PREVIEW_ROLES = [
  {value: 'main', label: '본 화면'},
  {value: 'stage', label: '무대'},
  {value: 'broadcast', label: '방송 자막'},
] as const;
export type PreviewRole = (typeof PREVIEW_ROLES)[number]['value'];

/**
 * The current Look as the output would draw this screen (the same rules as
 * the output windows), without subscribing to or changing output.
 */
export function previewAppearance(
  role: PreviewRole,
  looks: LooksFile | undefined,
  screens: ScreensFile | undefined,
) {
  const configured = resolveOutputScreen(role, screens?.screens ?? []);
  const starter = parsePayload(screenIdSchema, STARTER_SCREEN_IDS[role]);
  if (!starter.ok) throw new Error('Invalid starter screen');
  const screen: RenderScreen = {
    id: configured?.id ?? starter.value,
    kind: configured?.kind ?? (role === 'stage' ? 'stage' : 'audience'),
  };
  const {appearance} = resolveScreenLook(looks ?? null, looks?.current, screen);
  const backdrop =
    role === 'broadcast' ? (configured?.previewBackground ?? 'green') : 'black';
  const color = appearance?.background ?? null;
  return {
    screen,
    style: appearance?.lyricStyle ?? DEFAULT_LYRIC_STYLE,
    styleName: appearance?.lyricStyleName ?? '기본',
    slide: showsLayer(appearance, 'slide'),
    media: showsLayer(appearance, 'media'),
    background:
      color ??
      (backdrop === 'green'
        ? 'var(--chroma)'
        : backdrop === 'checker'
          ? 'transparent'
          : 'var(--output-black)'),
    checker: backdrop === 'checker' && color === null,
  };
}

/** A local selected song picture; no service selection or output command. */
export function selectedPreview(
  song: AnySong,
  {
    block,
    background,
  }: {readonly block: number; readonly background: string | undefined},
  appearance: Pick<ReturnType<typeof previewAppearance>, 'slide' | 'media'>,
): LiveLayers {
  const slides = isGroupedSong(song) ? linearSlidesOf(song) : song.slides;
  const slide = slides[block];
  if (!appearance.slide || slide === undefined) {
    return {
      ...emptyLayers(),
      media:
        !appearance.media || background === undefined
          ? null
          : {mediaId: background, loop: true, startedAt: 0},
    };
  }
  const addr = isGroupedSong(song)
    ? linearBlockAddress(song, block)
    : undefined;
  const rawLabel = addr !== undefined ? addr.groupName : slide.label;
  const label = rawLabel === undefined || rawLabel === '' ? null : rawLabel;
  return {
    ...emptyLayers(),
    slide: {
      itemId: song.id,
      position: block,
      label,
      lines: slide.lines,
    },
    media:
      !appearance.media || background === undefined
        ? null
        : {mediaId: background, loop: true, startedAt: 0},
  };
}
