import {emptyLayers, type LiveLayers} from '@core/live/state';
import {STARTER_SCREEN_IDS, resolveOutputScreen} from '@core/screens/screens';
import {screenIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {LooksFile} from '@core/schema/looks';
import type {ScreensFile} from '@core/schema/screens';
import type {RenderScreen} from '@renderer/render/layer';
import {
  DEFAULT_LYRIC_STYLE,
  renderLyricStyle,
} from '@renderer/render/lyricStyle';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import {linearBlockAddress, linearSlidesOf} from './blockEdits';

export const PREVIEW_ROLES = [
  {value: 'main', label: '본 화면'},
  {value: 'stage', label: '무대'},
  {value: 'broadcast', label: '방송 자막'},
] as const;
export type PreviewRole = (typeof PREVIEW_ROLES)[number]['value'];

/** Resolves the checked current Look without subscribing to or changing output. */
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
  const look = looks?.looks.find(item => item.id === looks.current);
  const binding = look?.screens[screen.id];
  const style = looks?.lyricStyles.find(
    item => item.id === binding?.lyricStyle,
  );
  const backdrop =
    role === 'broadcast' ? (configured?.previewBackground ?? 'green') : 'black';
  return {
    screen,
    style: style === undefined ? DEFAULT_LYRIC_STYLE : renderLyricStyle(style),
    styleName: style?.name ?? '기본',
    slide: look === undefined || binding?.layers.slide === true,
    media:
      (look === undefined || binding?.layers.media === true) &&
      binding?.background?.kind !== 'color',
    background:
      binding?.background?.kind === 'color'
        ? binding.background.color
        : backdrop === 'green'
          ? 'var(--chroma)'
          : backdrop === 'checker'
            ? 'transparent'
            : 'var(--output-black)',
    checker: backdrop === 'checker' && binding?.background?.kind !== 'color',
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
