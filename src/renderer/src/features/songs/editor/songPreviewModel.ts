import {emptyLayers, type LiveLayers} from '@core/live/state';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';
import {screenIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {ThemesFile} from '@core/schema/themes';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {Screen, ScreensFile} from '@core/schema/screens';
import type {RenderScreen, ThemeFrame} from '@renderer/rendering/layer';
import {resolveThemeOutput} from '@core/themes/output';
import type {GroupedSong} from '@core/schema/groupedSong';
import {linearBlockAddress, linearSlidesOf} from '@core/songs/blockEdits';

export const PREVIEW_ROLES = [
  {value: 'audience', label: '청중 화면'},
  {value: 'stage', label: '무대 화면'},
  {value: 'broadcast', label: '방송 화면'},
] as const;
export type PreviewRole = (typeof PREVIEW_ROLES)[number]['value'];

const STARTER_ID_OF_ROLE: Readonly<Record<PreviewRole, string>> = {
  audience: STARTER_SCREEN_IDS.main,
  stage: STARTER_SCREEN_IDS.stage,
  broadcast: STARTER_SCREEN_IDS.broadcast,
};

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
  const configured = screens?.screens.find(
    screen => screen.id === STARTER_ID_OF_ROLE[role],
  );
  const starter = parsePayload(screenIdSchema, STARTER_ID_OF_ROLE[role]);
  if (!starter.ok) throw new Error('Invalid starter screen');
  const target: Screen = configured ?? {
    id: starter.value,
    name: role,
    kind: role,
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
        ? item.kind === 'bible' || item.kind === 'blank'
          ? '말씀'
          : item.kind === 'notice' || item.kind === 'ad'
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
  song: GroupedSong,
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
  const slides = linearSlidesOf(song);
  const project = (index: number | undefined) => {
    const slide = index === undefined ? undefined : slides[index];
    if (slide === undefined || index === undefined) return undefined;
    const rawLabel = linearBlockAddress(song, index)?.groupName;
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
