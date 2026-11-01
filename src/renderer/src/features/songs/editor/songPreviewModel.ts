import {emptyLayers, type LiveLayers} from '@core/live/state';
import {STARTER_SCREEN_IDS, resolveOutputScreen} from '@core/screens/screens';
import {screenIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {ThemesFile} from '@core/schema/themes';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {Screen, ScreensFile} from '@core/schema/screens';
import type {RenderScreen, ThemeFrame} from '@renderer/rendering/layer';
import {resolveThemeOutput} from '@core/themes/output';
import {isGroupedSong, type AnySong} from '@core/schema/groupedSong';
import {linearBlockAddress, linearSlidesOf} from '@core/songs/blockEdits';

export const PREVIEW_ROLES = [
  {value: 'main', label: '본 화면'},
  {value: 'stage', label: '무대'},
  {value: 'broadcast', label: '방송 자막'},
] as const;
export type PreviewRole = (typeof PREVIEW_ROLES)[number]['value'];

/** Resolves a local item with the same theme rules as the main output. */
export function previewAppearance({
  role,
  themes,
  screens,
  item = {id: 'preview', kind: 'song', source: 'external'},
}: {
  readonly role: PreviewRole;
  readonly themes: ThemesFile | undefined;
  readonly screens: ScreensFile | undefined;
  readonly item?: LiveThemeItem | undefined;
}) {
  const configured = resolveOutputScreen(role, screens?.screens ?? []);
  const starter = parsePayload(screenIdSchema, STARTER_SCREEN_IDS[role]);
  if (!starter.ok) throw new Error('Invalid starter screen');
  const target: Screen = configured ?? {
    id: starter.value,
    name: role,
    kind: role === 'stage' ? 'stage' : 'audience',
    method: role === 'broadcast' ? 'capture' : 'fullscreen',
  };
  const all =
    configured === undefined
      ? [...(screens?.screens ?? []), target]
      : (screens?.screens ?? [target]);
  const output = resolveThemeOutput({
    file: themes ?? null,
    screens: all,
    item,
    revision: 0,
  });
  const composition = output.screens[target.id];
  if (composition === undefined) throw new Error('Missing preview composition');
  const theme: ThemeFrame = {
    ...composition,
    themeId: output.themeId,
    revision: output.revision,
    missing: output.missing,
    item,
  };
  const screen: RenderScreen = {
    id: target.id,
    kind: target.kind,
    method: target.method,
  };
  const themeName = themes?.themes.find(
    entry => entry.id === output.themeId,
  )?.name;
  return {
    screen,
    theme,
    themeName:
      themeName === undefined
        ? item.kind === 'bible'
          ? '말씀'
          : item.kind === 'notice'
            ? '광고'
            : item.kind === 'media'
              ? '영상'
              : '찬양'
        : themeName || '이름 없는 테마',
    background: composition.layout.background ?? composition.emptyColor,
    checker: false,
  };
}

/** A local selected song picture; no service selection or output command. */
export function selectedPreview(
  song: AnySong,
  {
    block,
    background,
    nextBlock,
  }: {
    readonly block: number;
    readonly background: string | undefined;
    readonly nextBlock?: number | undefined;
  },
): LiveLayers {
  const slides = isGroupedSong(song) ? linearSlidesOf(song) : song.slides;
  const project = (index: number | undefined) => {
    const slide = index === undefined ? undefined : slides[index];
    if (slide === undefined || index === undefined) return undefined;
    const addr = isGroupedSong(song)
      ? linearBlockAddress(song, index)
      : undefined;
    const rawLabel = addr === undefined ? slide.label : addr.groupName;
    return {
      lines: slide.lines,
      label: rawLabel === undefined || rawLabel === '' ? null : rawLabel,
    };
  };
  const slide = project(block);
  if (slide === undefined) {
    return {
      ...emptyLayers(),
      media:
        background === undefined
          ? null
          : {mediaId: background, loop: true, startedAt: 0},
    };
  }
  const next = project(nextBlock);
  return {
    ...emptyLayers(),
    slide: {
      itemId: song.id,
      position: block,
      label: slide.label,
      lines: slide.lines,
      ...(next === undefined ? {} : {next}),
    },
    media:
      background === undefined
        ? null
        : {mediaId: background, loop: true, startedAt: 0},
  };
}
