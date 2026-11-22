import type {SettingsReader} from '@core/schema/settingsReader';
import type {LiveCommand} from '@core/live/commands';
import type {LiveState} from '@core/live/state';
import type {
  LiveItem,
  LiveThemeMode,
  LiveThemeOutput,
} from '@core/schema/liveTheme';
import type {Screen} from '@core/schema/screens';
import type {SlideBackground} from '@core/schema/theme';
import type {Themes} from '@core/schema/themes';
import {emptyScreenColor} from '@core/screens/emptyColor';
import {
  themeFor,
  themeOf,
  themeOfSlide,
  type ThemedSlide,
} from '@core/theme/themes';
import {resetClearToggles, type LiveHistory, type UndoEntry} from './history';
import type {ThemeReduction} from './slice';

const THEME_COMMANDS = [
  'item.start',
  'slide.show',
  'slide.update',
  'media.show',
  'theme.set',
  'themes.refresh',
  'layer.clear',
  'layer.clear.toggle',
  'clear.undo',
  'item.stop',
  'item.restore',
] as const;
type ThemeCommand = Extract<
  LiveCommand,
  {type: (typeof THEME_COMMANDS)[number]}
>;
function affectsTheme(command: LiveCommand): command is ThemeCommand {
  return THEME_COMMANDS.some(type => command.type === type);
}

/**
 * The item as it is saved now, so edits made while it is live (its 오버레이 and
 * 메모) reach the next slide, with the times it gathered on output. A new slide
 * also ends a clear.
 */
function withPlayback(saved: LiveItem, live: LiveItem): LiveItem {
  const {contentCleared: _cleared, ...item} = saved;
  const {startedAt, overlayStartedAt, slidePosition} = live;
  return {
    ...item,
    ...(startedAt === undefined ? {} : {startedAt}),
    ...(overlayStartedAt === undefined ? {} : {overlayStartedAt}),
    ...(slidePosition === undefined ? {} : {slidePosition}),
  };
}

function overlayOn(item: LiveItem | null | undefined) {
  const position = item?.slidePosition;
  if (item == null || position === undefined || item.contentCleared) return;
  return item.overlays?.find(
    overlay => overlay.from <= position + 1 && overlay.to >= position + 1,
  );
}

interface ThemeRuntimeOptions {
  readonly settings: Pick<SettingsReader, 'get'>;
  readonly item: (id: string) => LiveItem | undefined;
  readonly onError: (error: unknown) => void;
  readonly onMissingTheme?: (id: string) => void;
}

/** Keeps the live item and its theme in step with what is on output. */
export class ThemeRuntime {
  private themes: Themes | null = null;
  private screens: readonly Screen[] = [];
  private revision = 0;
  private key: string | null = null;
  private output: LiveThemeOutput | undefined;
  private readonly reportedMissingThemes = new Set<string>();

  constructor(private readonly options: ThemeRuntimeOptions) {
    this.refresh();
  }

  refresh(): void {
    try {
      const themes = this.options.settings.get('themes');
      if (themes.name === 'themes') {
        this.themes = themes.value;
        this.revision = themes.revision;
      }
    } catch (error) {
      this.options.onError(error);
    }
    try {
      const screens = this.options.settings.get('screens');
      if (screens.name === 'screens') this.screens = screens.value.screens;
    } catch (error) {
      this.options.onError(error);
    }
    this.key = null;
  }

  /** What the theme of a slide puts behind it. */
  background(slide: ThemedSlide): SlideBackground {
    return themeOfSlide(this.themes, slide).background;
  }

  reduce({before, after, command, context}: ThemeReduction): LiveHistory {
    if (!affectsTheme(command)) return after;
    let item = after.state.item ?? null;
    let mode = after.state.themeMode;
    switch (command.type) {
      case 'item.start':
        after = resetClearToggles(after);
        item = this.options.item(command.itemId) ?? item;
        if (item !== null) item = {...item, startedAt: context.now};
        mode = undefined;
        break;
      case 'slide.show': {
        const {slide} = command;
        if (item?.id !== slide.itemId || item.source === 'external') {
          item = this.options.item(slide.itemId) ?? {
            id: slide.itemId,
            kind: slide.kind ?? 'blank',
            source: 'external',
            ...(slide.title === undefined ? {} : {title: slide.title}),
          };
          mode = undefined;
        } else {
          item = withPlayback(this.options.item(item.id) ?? item, item);
        }
        item = {
          ...item,
          startedAt: item.startedAt ?? context.now,
          slidePosition: slide.position,
        };
        const previous = before.state.item;
        const active = overlayOn(item);
        if (
          active !== undefined &&
          (previous?.id !== item.id || overlayOn(previous)?.id !== active.id)
        ) {
          item = {...item, overlayStartedAt: context.now};
        }
        break;
      }
      case 'slide.update': {
        const {slide} = command;
        if (item?.id !== slide.itemId) break;
        item = {
          ...item,
          slidePosition: slide.position,
          ...(item.source === 'service' || slide.title === undefined
            ? {}
            : {title: slide.title}),
        };
        break;
      }
      case 'media.show':
        if (after.state.layers.slide === null) {
          item = {
            id: command.media.mediaId,
            kind: 'media',
            source: 'external',
            startedAt: context.now,
            ...(command.media.title === undefined
              ? {}
              : {title: command.media.title}),
          };
          mode = undefined;
        } else if (item?.contentCleared) {
          item = {...item, contentCleared: false};
        }
        break;
      case 'theme.set':
        mode = {kind: 'manual', id: command.themeId};
        break;
      case 'themes.refresh':
        this.refresh();
        if (item !== null) {
          const cleared = item.contentCleared;
          item = withPlayback(this.options.item(item.id) ?? item, item);
          if (cleared) item = {...item, contentCleared: true};
        }
        break;
      case 'layer.clear':
      case 'layer.clear.toggle':
        if (command.target === 'all' && item !== null) {
          const restored =
            command.type === 'layer.clear.toggle'
              ? before.clearSnapshots?.all
              : undefined;
          if (restored?.item != null && item.contentCleared) {
            item = resumed(restored.item, context.now - restored.clearedAt);
            mode = restored.themeMode;
            break;
          }
          if (restored !== undefined || item.contentCleared) break;
          const undo = {
            ...(after === before || after.undo === null
              ? {layers: before.state.layers, clearedAt: context.now}
              : after.undo),
            item,
            ...(mode === undefined ? {} : {themeMode: mode}),
          };
          after = {
            ...after,
            undo,
            state: {...after.state, canUndo: true},
          };
          if (command.type === 'layer.clear.toggle') {
            after = {
              ...after,
              clearSnapshots: {...after.clearSnapshots, all: undo},
            };
          }
          item = {...item, contentCleared: true};
        }
        break;
      case 'clear.undo':
        if (before.undo?.item !== undefined) {
          item = resumed(before.undo.item, context.now - before.undo.clearedAt);
          mode = before.undo.themeMode;
        }
        break;
      case 'item.restore': {
        const saved = before.stoppedItem;
        if (saved == null || after === before) return after;
        item = resumed(saved.item ?? null, context.now - saved.clearedAt);
        mode = saved.themeMode;
        break;
      }
      case 'item.stop': {
        if (item === null) return after;
        const undo: UndoEntry = {
          layers: after.state.layers,
          clearedAt: context.now,
          item,
          itemOnly: true,
          ...(mode === undefined ? {} : {themeMode: mode}),
        };
        after = {
          ...after,
          undo,
          stoppedItem: undo,
          state: {
            ...after.state,
            canUndo: true,
            canRestoreItem: true,
            layers: {...after.state.layers, slide: null, media: null},
          },
        };
        item = null;
        mode = undefined;
        break;
      }
      default:
        return after;
    }
    return this.publish(after, item, mode);
  }

  /** The theme of the live slide, or 대기 화면 when nothing is on. */
  private resolve(
    {layers}: LiveState,
    item: LiveItem | null,
    mode: LiveThemeMode | undefined,
  ): LiveThemeOutput {
    const wanted = mode?.id ?? layers.slide?.theme;
    const own = wanted === undefined ? undefined : themeOf(this.themes, wanted);
    const theme =
      own ??
      (wanted === undefined
        ? themeFor(this.themes, isOwnMedia(layers, item) ? 'media' : 'standby')
        : themeOfSlide(this.themes, {
            theme: wanted,
            texts: layers.slide?.texts ?? {},
          }));
    return {
      theme,
      background: layers.slide?.background ?? theme.background,
      revision: this.revision,
      missing: wanted !== undefined && own === undefined ? [wanted] : [],
      emptyColors: Object.fromEntries(
        this.screens.map(screen => [screen.id, emptyScreenColor(screen)]),
      ),
    };
  }

  private publish(
    history: LiveHistory,
    item: LiveItem | null,
    mode: LiveThemeMode | undefined,
  ): LiveHistory {
    const {state} = history;
    const cleared =
      item?.contentCleared === true || state.layers.slide === null;
    const {slide} = state.layers;
    const key = JSON.stringify([
      slide?.theme,
      slide?.background,
      item === null,
      isOwnMedia(state.layers, item),
      mode,
    ]);
    // NOTE(0913vision): A clear keeps the theme it cleared, so what is left of
    // the slide stays where it is.
    if (
      this.output === undefined ||
      this.key === null ||
      (this.key !== key &&
        !(
          cleared &&
          item !== null &&
          mode === undefined &&
          !isOwnMedia(state.layers, item)
        ))
    ) {
      this.output = this.resolve(state, item, mode);
      this.key = key;
      for (const id of this.output.missing) {
        if (this.reportedMissingThemes.has(id)) continue;
        this.reportedMissingThemes.add(id);
        this.options.onMissingTheme?.(id);
      }
    }
    if (
      state.item === item &&
      state.themeMode === mode &&
      state.themeOutput === this.output
    ) {
      return history;
    }
    const {themeMode: _mode, themeOutput: _output, ...rest} = state;
    return {
      ...history,
      state: {
        ...rest,
        item,
        ...(mode === undefined ? {} : {themeMode: mode}),
        themeOutput: this.output,
        version: state.version + 1,
      },
    };
  }
}

/** Whether media the operator chose is on output by itself. */
function isOwnMedia(
  {slide, media}: LiveState['layers'],
  item: LiveItem | null,
): boolean {
  return (
    slide === null &&
    item?.kind === 'media' &&
    item.source === 'external' &&
    media?.mediaId === item.id
  );
}

/** The item with the time it was cleared for taken out of its overlay's. */
function resumed(item: LiveItem | null, elapsed: number): LiveItem | null {
  return item?.overlayStartedAt === undefined
    ? item
    : {
        ...item,
        overlayStartedAt: item.overlayStartedAt + Math.max(0, elapsed),
      };
}
