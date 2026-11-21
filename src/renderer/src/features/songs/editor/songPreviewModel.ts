import {emptyLayers, type LiveLayers} from '@core/live/state';
import {SCREEN_KIND_ORDER, STARTER_SCREEN_IDS} from '@core/screens/screens';
import {screenIdSchema} from '@core/schema/ids';
import {parsePayload} from '@core/schema/payload';
import type {ThemesFile} from '@core/schema/themes';
import type {LiveThemeItem} from '@core/schema/liveTheme';
import type {Screen, ScreensFile} from '@core/schema/screens';
import type {RenderScreen, ThemeFrame} from '@renderer/rendering/layer';
import {resolveRenderScreen} from '@renderer/rendering/screenIdentity';
import {themeBackgroundColor} from '@renderer/rendering/themeBackground';
import {resolveThemeOutput} from '@core/themes/output';
import type {Song} from '@core/schema/song';
import {linearSlidesOf} from '@core/songs/blockEdits';
import {songSlideBackground} from '@core/songs/songBackground';
import type {StageLyricLabelPosition} from '@core/schema/preferences';

const ROLE_LABELS = {
  audience: '청중 화면',
  stage: '무대 화면',
  broadcast: '방송 화면',
};
export const PREVIEW_ROLES = SCREEN_KIND_ORDER.map(value => ({
  value,
  label: ROLE_LABELS[value],
}));
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
  screenId,
  stageLyricLabelPosition,
}: {
  readonly role: PreviewRole;
  readonly themes: ThemesFile | undefined;
  readonly screens: ScreensFile | undefined;
  readonly item?: LiveThemeItem | undefined;
  readonly screenId?: string | undefined;
  readonly stageLyricLabelPosition?: StageLyricLabelPosition | undefined;
}) {
  const configured =
    screens?.screens.find(
      screen => screen.id === screenId && screen.kind === role,
    ) ?? screens?.screens.find(screen => screen.kind === role);
  const starter = parsePayload(screenIdSchema, STARTER_ID_OF_ROLE[role]);
  if (!starter.ok) throw new Error('Invalid starter screen');
  const target: Screen = configured ?? {
    id: starter.value,
    name: role,
    kind: role,
    method: role === 'broadcast' ? 'capture' : 'fullscreen',
  };
  const configuredScreens =
    configured === undefined
      ? [...(screens?.screens ?? []), target]
      : (screens?.screens ?? [target]);
  const audienceTarget =
    role === 'stage'
      ? configuredScreens.find(value => value.kind === 'audience')
      : undefined;
  const all = configuredScreens;
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
  const screen: RenderScreen = resolveRenderScreen(target.id, all) ?? {
    id: target.id,
    kind: target.kind,
    method: target.method,
  };
  const audienceComposition =
    audienceTarget === undefined
      ? undefined
      : output.screens[audienceTarget.id];
  const audienceScreen =
    audienceTarget === undefined
      ? undefined
      : resolveRenderScreen(audienceTarget.id, all);
  const audience =
    audienceComposition === undefined || audienceScreen === undefined
      ? undefined
      : {
          screen: audienceScreen,
          theme: {
            ...audienceComposition,
            themeId: output.themeId,
            revision: output.revision,
            missing: output.missing,
            item,
          },
        };
  const deleted = themes?.deletedThemes?.find(
    entry => entry.id === output.themeId,
  );
  const themeName =
    themes?.standby.id === output.themeId
      ? themes.standby.name
      : themes?.themes.find(entry => entry.id === output.themeId)?.name;
  return {
    screen,
    theme,
    ...(audience === undefined ? {} : {audience}),
    ...(role === 'stage' && stageLyricLabelPosition !== undefined
      ? {stageLyricLabelPosition}
      : {}),
    themeName:
      deleted !== undefined
        ? `(${deleted.name})`
        : themeName === undefined
          ? item.kind === 'bible' || item.kind === 'blank'
            ? '말씀'
            : item.kind === 'ad'
              ? '광고'
              : item.kind === 'media'
                ? '영상'
                : '찬양'
          : themeName || '이름 없는 테마',
    background: themeBackgroundColor(
      composition.layout.background,
      composition.emptyColor,
    ),
    checker: false,
  };
}

/** Resolve the complete configured screen set once for local pictures. */
export function previewAppearances({
  themes,
  screens,
  item,
  stageLyricLabelPosition,
}: {
  readonly themes: ThemesFile | undefined;
  readonly screens: ScreensFile | undefined;
  readonly item: LiveThemeItem;
  readonly stageLyricLabelPosition?: StageLyricLabelPosition | undefined;
}) {
  const targets = screens?.screens ?? [];
  const output = resolveThemeOutput({
    file: themes ?? null,
    screens: targets,
    item,
    revision: 0,
  });
  const audienceTarget = targets.find(screen => screen.kind === 'audience');
  const audienceComposition =
    audienceTarget === undefined
      ? undefined
      : output.screens[audienceTarget.id];
  const audienceScreen =
    audienceTarget === undefined
      ? undefined
      : resolveRenderScreen(audienceTarget.id, targets);
  const audience =
    audienceComposition === undefined || audienceScreen === undefined
      ? undefined
      : {
          screen: audienceScreen,
          theme: {
            ...audienceComposition,
            themeId: output.themeId,
            revision: output.revision,
            missing: output.missing,
            item,
          },
        };
  const deleted = themes?.deletedThemes?.find(
    entry => entry.id === output.themeId,
  );
  const themeName =
    themes?.standby.id === output.themeId
      ? themes.standby.name
      : themes?.themes.find(entry => entry.id === output.themeId)?.name;
  const label =
    deleted !== undefined
      ? `(${deleted.name})`
      : themeName === undefined
        ? item.kind === 'bible' || item.kind === 'blank'
          ? '말씀'
          : item.kind === 'ad'
            ? '광고'
            : item.kind === 'media'
              ? '영상'
              : '찬양'
        : themeName || '이름 없는 테마';
  return new Map(
    targets.flatMap(target => {
      const composition = output.screens[target.id];
      const screen = resolveRenderScreen(target.id, targets);
      if (composition === undefined || screen === undefined) return [];
      const theme = {
        ...composition,
        themeId: output.themeId,
        revision: output.revision,
        missing: output.missing,
        item,
      };
      return [
        [
          target.id,
          {
            screen,
            theme,
            ...(target.kind === 'stage' && audience !== undefined
              ? {audience}
              : {}),
            ...(target.kind === 'stage' && stageLyricLabelPosition !== undefined
              ? {stageLyricLabelPosition}
              : {}),
            themeName: label,
            background: themeBackgroundColor(
              composition.layout.background,
              composition.emptyColor,
            ),
            checker: false,
          },
        ] as const,
      ];
    }),
  );
}

/** A local selected song picture; no service selection or output command. */
export function selectedPreview(
  song: Song,
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
    const rawLabel = slide.label;
    return {
      lines: slide.lines,
      ...(slide.titleSlide === undefined ? {} : {titleSlide: slide.titleSlide}),
      ...(slide.titleLineCount === undefined
        ? {}
        : {titleLineCount: slide.titleLineCount}),
      ...(slide.titleLayout === undefined
        ? {}
        : {titleLayout: slide.titleLayout}),
      ...(slide.lyricFormat === undefined
        ? {}
        : {lyricFormat: slide.lyricFormat}),
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
  const transition = slides[block]?.transition;
  const slideBackground = songSlideBackground(
    slides[block]?.picture,
    background,
  );
  return {
    ...emptyLayers(),
    slide: {
      itemId: song.id,
      position: block,
      label: slide.label,
      lines: slide.lines,
      ...(slide.titleSlide === undefined ? {} : {titleSlide: slide.titleSlide}),
      ...(slide.titleLineCount === undefined
        ? {}
        : {titleLineCount: slide.titleLineCount}),
      ...(slide.titleLayout === undefined
        ? {}
        : {titleLayout: slide.titleLayout}),
      ...(slide.lyricFormat === undefined
        ? {}
        : {lyricFormat: slide.lyricFormat}),
      ...(transition === undefined ? {} : {transition}),
      ...(next === undefined ? {} : {next}),
    },
    media:
      slideBackground === undefined
        ? null
        : {mediaId: slideBackground, loop: true, startedAt: 0},
  };
}
