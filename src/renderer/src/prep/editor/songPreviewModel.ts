import {emptyLayers, type LiveLayers} from '@shared/live';
import {STARTER_SCREEN_IDS, resolveOutputScreen} from '@shared/screens';
import {screenIdSchema} from '@shared/schema/ids';
import {parsePayload} from '@shared/schema/payload';
import type {LooksFile} from '@shared/schema/looks';
import type {ScreensFile} from '@shared/schema/screens';
import type {RenderScreen} from '@renderer/render/layer';
import {DEFAULT_LYRIC_STYLE} from '@renderer/render/lyricStyle';
import {isGroupedSong, linearSlidesOf, type AnySong} from './blockEdits';

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
    style: style ?? DEFAULT_LYRIC_STYLE,
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
  return {
    ...emptyLayers(),
    slide:
      !appearance.slide || slide === undefined
        ? null
        : {
            itemId: song.id,
            position: block,
            label: slide.label === '' ? null : (slide.label ?? null),
            lines: slide.lines,
          },
    media:
      !appearance.media || background === undefined
        ? null
        : {mediaId: background, loop: true, startedAt: 0},
  };
}
