import type {SettingsReader} from '@core/schema/app/settingsReader';
import type {LiveCommand} from '@core/schema/live/liveCommand';
import type {LiveState, MediaChoice, SlideLayer} from '@core/schema/live/live';
import type {
  LiveItem,
  LiveThemeMode,
  LiveThemeOutput,
} from '@core/schema/live/liveTheme';
import type {Screen} from '@core/schema/screens/screens';
import type {SlideBackground} from '@core/schema/screens/theme';
import type {Themes} from '@core/schema/screens/themes';
import {emptyScreenColor} from '@core/screens';
import {themeFor, themeOf, themeOfSlide, type ThemedSlide} from '@core/theme';
import {resetClearToggles, type LiveHistory, type UndoEntry} from '../history';
import type {ThemeReduction} from '../slice';

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
    const step = this.step(command, {
      before,
      after,
      now: context.now,
      item: after.state.item ?? null,
      mode: after.state.themeMode,
    });
    return step === null
      ? after
      : this.publish(step.after, step.item, step.mode);
  }

  /** What a theme command makes of the live item; null leaves it all as is. */
  private step(command: ThemeCommand, current: ItemStep): ItemStep | null {
    switch (command.type) {
      case 'item.start':
        return this.startItem(command.itemId, current);
      case 'slide.show':
        return this.showSlide(command.slide, current);
      case 'slide.update':
        return updateSlide(command.slide, current);
      case 'media.show':
        return showMedia(command.media, current);
      case 'theme.set':
        return {...current, mode: {kind: 'manual', id: command.themeId}};
      case 'themes.refresh':
        this.refresh();
        return this.refreshItem(current);
      case 'layer.clear':
      case 'layer.clear.toggle':
        return command.target === 'all'
          ? clearAll(command.type === 'layer.clear.toggle', current)
          : current;
      case 'clear.undo':
        return undoClear(current);
      case 'item.restore':
        return restoreItem(current);
      case 'item.stop':
        return stopItem(current);
    }
  }

  /** A new item starts: clear toggles reset, its clock starts, its own theme. */
  private startItem(itemId: string, current: ItemStep): ItemStep {
    const item = this.options.item(itemId) ?? current.item;
    return {
      ...current,
      after: resetClearToggles(current.after),
      item: item === null ? null : {...item, startedAt: current.now},
      mode: undefined,
    };
  }

  /**
   * A slide comes on: another item takes its own theme, the same item keeps
   * its clock and takes its saved edits; an overlay that starts with this
   * slide starts its clock.
   */
  private showSlide(slide: SlideLayer, current: ItemStep): ItemStep {
    const {before, now} = current;
    let {item, mode} = current;
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
      startedAt: item.startedAt ?? now,
      slidePosition: slide.position,
    };
    const previous = before.state.item;
    const active = overlayOn(item);
    if (
      active !== undefined &&
      (previous?.id !== item.id || overlayOn(previous)?.id !== active.id)
    ) {
      item = {...item, overlayStartedAt: now};
    }
    return {...current, item, mode};
  }

  /** The themes changed: the item takes its saved edits and keeps a clear. */
  private refreshItem(current: ItemStep): ItemStep {
    const {item} = current;
    if (item === null) return current;
    const refreshed = withPlayback(this.options.item(item.id) ?? item, item);
    return {
      ...current,
      item: item.contentCleared
        ? {...refreshed, contentCleared: true}
        : refreshed,
    };
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
/** What a theme command works on and makes: the history, the item, the mode. */
interface ItemStep {
  readonly before: LiveHistory;
  readonly after: LiveHistory;
  readonly now: number;
  readonly item: LiveItem | null;
  readonly mode: LiveThemeMode | undefined;
}

/** The live slide changed in place: its position, and its title when outside. */
function updateSlide(slide: SlideLayer, current: ItemStep): ItemStep {
  const {item} = current;
  if (item?.id !== slide.itemId) return current;
  return {
    ...current,
    item: {
      ...item,
      slidePosition: slide.position,
      ...(item.source === 'service' || slide.title === undefined
        ? {}
        : {title: slide.title}),
    },
  };
}

/**
 * Media comes on: without a slide it is the live item itself; over a slide it
 * ends a clear of the slide's item.
 */
function showMedia(media: MediaChoice, current: ItemStep): ItemStep {
  const {after, item, now} = current;
  if (after.state.layers.slide === null) {
    return {
      ...current,
      item: {
        id: media.mediaId,
        kind: 'media',
        source: 'external',
        startedAt: now,
        ...(media.title === undefined ? {} : {title: media.title}),
      },
      mode: undefined,
    };
  }
  return item?.contentCleared
    ? {...current, item: {...item, contentCleared: false}}
    : current;
}

/**
 * Clear all clears the item and keeps an undo of it; as a toggle, a second
 * press brings back what the first cleared.
 */
function clearAll(toggle: boolean, current: ItemStep): ItemStep {
  const {before, item, mode, now} = current;
  if (item === null) return current;
  const restored = toggle ? before.clearSnapshots?.all : undefined;
  if (restored?.item != null && item.contentCleared) {
    return {
      ...current,
      item: resumed(restored.item, now - restored.clearedAt),
      mode: restored.themeMode,
    };
  }
  if (restored !== undefined || item.contentCleared) return current;
  let {after} = current;
  const undo = {
    ...(after === before || after.undo === null
      ? {layers: before.state.layers, clearedAt: now}
      : after.undo),
    item,
    ...(mode === undefined ? {} : {themeMode: mode}),
  };
  after = {...after, undo, state: {...after.state, canUndo: true}};
  if (toggle) {
    after = {...after, clearSnapshots: {...after.clearSnapshots, all: undo}};
  }
  return {...current, after, item: {...item, contentCleared: true}};
}

/** Brings back the item and theme mode that the last clear took away. */
function undoClear(current: ItemStep): ItemStep {
  const {undo} = current.before;
  if (undo?.item === undefined) return current;
  return {
    ...current,
    item: resumed(undo.item, current.now - undo.clearedAt),
    mode: undo.themeMode,
  };
}

/** Brings back the item that stopping took off; null when there is none. */
function restoreItem(current: ItemStep): ItemStep | null {
  const saved = current.before.stoppedItem;
  if (saved == null || current.after === current.before) return null;
  return {
    ...current,
    item: resumed(saved.item ?? null, current.now - saved.clearedAt),
    mode: saved.themeMode,
  };
}

/**
 * Stops the item: takes the slide and media off with it and keeps all of it
 * to restore; null when no item is live.
 */
function stopItem(current: ItemStep): ItemStep | null {
  const {after, item, mode, now} = current;
  if (item === null) return null;
  const undo: UndoEntry = {
    layers: after.state.layers,
    clearedAt: now,
    item,
    itemOnly: true,
    ...(mode === undefined ? {} : {themeMode: mode}),
  };
  return {
    ...current,
    after: {
      ...after,
      undo,
      stoppedItem: undo,
      state: {
        ...after.state,
        canUndo: true,
        canRestoreItem: true,
        layers: {...after.state.layers, slide: null, media: null},
      },
    },
    item: null,
    mode: undefined,
  };
}

function resumed(item: LiveItem | null, elapsed: number): LiveItem | null {
  return item?.overlayStartedAt === undefined
    ? item
    : {
        ...item,
        overlayStartedAt: item.overlayStartedAt + Math.max(0, elapsed),
      };
}
