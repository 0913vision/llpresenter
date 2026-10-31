import type {SettingsReader} from '@core/schema/settingsReader';
import type {LiveCommand} from '@core/live/commands';
import type {LiveThemeItem, LiveThemeMode} from '@core/schema/liveTheme';
import type {Screen} from '@core/schema/screens';
import type {ThemesFile} from '@core/schema/themes';
import {resolveThemeOutput} from '@core/themes/output';
import {resetClearToggles, type LiveHistory, type UndoEntry} from './history';
import type {ThemeReduction} from './slice';

const THEME_COMMANDS = [
  'item.start',
  'slide.show',
  'media.show',
  'theme.set',
  'look.set',
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

interface ThemeRuntimeOptions {
  readonly settings: Pick<SettingsReader, 'get'>;
  readonly item: (id: string) => LiveThemeItem | undefined;
  readonly onError: (error: unknown) => void;
}

/** Resolves theme state inside the same admission boundary as the content command. */
export class ThemeRuntime {
  private file: ThemesFile | null = null;
  private screens: readonly Screen[] = [];
  private revision = 0;
  private key: string | null = null;
  private output: ReturnType<typeof resolveThemeOutput>;

  constructor(private readonly options: ThemeRuntimeOptions) {
    this.refresh();
  }

  refresh(): void {
    try {
      const themes = this.options.settings.get('themes');
      if (themes.name === 'themes') {
        this.file = themes.value;
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

  reduce({before, after, command, context}: ThemeReduction): LiveHistory {
    if (!affectsTheme(command)) return after;
    let item = after.state.themeItem ?? null;
    let mode = after.state.themeMode;
    switch (command.type) {
      case 'item.start':
        after = resetClearToggles(after);
        item = this.options.item(command.itemId) ?? item;
        if (item !== null) item = {...item, startedAt: context.now};
        mode = undefined;
        break;
      case 'slide.show':
        if (item?.id !== command.slide.itemId || item.source === 'external') {
          item = this.options.item(command.slide.itemId) ?? {
            id: command.slide.itemId,
            kind:
              command.slide.kind ??
              (command.slide.reference === undefined ? 'song' : 'bible'),
            source: 'external',
            ...((command.slide.title ?? command.slide.reference) === undefined
              ? {}
              : {title: command.slide.title ?? command.slide.reference}),
            ...(command.slide.memo === undefined
              ? {}
              : {memo: command.slide.memo}),
          };
          mode = undefined;
        } else if (item.contentCleared) item = {...item, contentCleared: false};
        {
          const position = command.slide.position + 1;
          const active = item.overlays?.find(
            overlay => overlay.from <= position && overlay.to >= position,
          );
          const previousPosition = before.state.themeItem?.contentCleared
            ? undefined
            : (before.state.themeItem?.slidePosition ??
              before.state.layers.slide?.position);
          const previous =
            previousPosition === undefined
              ? undefined
              : item.overlays?.find(
                  overlay =>
                    overlay.from <= previousPosition + 1 &&
                    overlay.to >= previousPosition + 1,
                );
          if (item.startedAt === undefined) {
            item = {...item, startedAt: context.now};
          }
          item = {...item, slidePosition: command.slide.position};
          if (
            active !== undefined &&
            (active.id !== previous?.id ||
              before.state.themeItem?.id !== item.id)
          ) {
            item = {...item, overlayStartedAt: context.now};
          }
        }
        break;
      case 'media.show':
        if (command.media.itemId !== undefined || item === null) {
          item = {
            id: command.media.itemId ?? command.media.mediaId,
            kind: 'media',
            source: 'external',
            startedAt: context.now,
            ...(command.media.title === undefined
              ? {}
              : {title: command.media.title}),
          };
          mode = undefined;
        } else if (item.contentCleared) item = {...item, contentCleared: false};
        break;
      case 'theme.set':
        mode = {kind: 'manual', id: command.themeId};
        break;
      case 'look.set':
        mode = {kind: 'legacy'};
        break;
      case 'themes.refresh':
        this.refresh();
        break;
      case 'layer.clear':
      case 'layer.clear.toggle':
        if (command.target === 'all' && item !== null) {
          const restored =
            command.type === 'layer.clear.toggle'
              ? before.clearSnapshots?.all
              : undefined;
          if (restored?.themeItem != null && item.contentCleared) {
            item = this.resumedItem(
              restored.themeItem,
              context.now - restored.clearedAt,
            );
            mode = restored.themeMode;
            break;
          }
          if (restored !== undefined) break;
          if (item.contentCleared) break;
          const undo = {
            ...(after === before || after.undo === null
              ? {layers: before.state.layers, clearedAt: context.now}
              : after.undo),
            themeItem: item,
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
              clearSnapshots: {
                ...after.clearSnapshots,
                all: undo,
              },
            };
          }
          item = {...item, contentCleared: true};
        }
        break;
      case 'clear.undo':
        if (before.undo?.themeItem !== undefined) {
          item = this.resumedItem(
            before.undo.themeItem,
            context.now - before.undo.clearedAt,
          );
          mode = before.undo.themeMode;
        }
        break;
      case 'item.restore': {
        const saved = before.stoppedItem;
        if (saved == null || after === before) return after;
        item = this.resumedItem(
          saved.themeItem ?? null,
          context.now - saved.clearedAt,
        );
        mode = saved.themeMode;
        break;
      }
      case 'item.stop': {
        if (item === null) return after;
        const undo: UndoEntry = {
          layers: after.state.layers,
          clearedAt: context.now,
          themeItem: item,
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

  private resumedItem(
    item: LiveThemeItem | null,
    elapsed: number,
  ): LiveThemeItem | null {
    return item?.overlayStartedAt === undefined
      ? item
      : {
          ...item,
          overlayStartedAt: item.overlayStartedAt + Math.max(0, elapsed),
        };
  }

  private publish(
    history: LiveHistory,
    item: LiveThemeItem | null,
    mode: LiveThemeMode | undefined,
  ): LiveHistory {
    const key = JSON.stringify([item?.kind, item?.source, item?.theme, mode]);
    if (this.key !== key) {
      this.output = resolveThemeOutput({
        file: this.file,
        screens: this.screens,
        item,
        mode,
        revision: this.revision,
      });
      this.key = key;
    }
    if (
      history.state.themeItem === item &&
      history.state.themeMode === mode &&
      history.state.themeOutput === this.output
    ) {
      return history;
    }
    const {themeMode: _mode, themeOutput: _output, ...state} = history.state;
    return {
      ...history,
      state: {
        ...state,
        themeItem: item,
        ...(mode === undefined ? {} : {themeMode: mode}),
        ...(this.output === undefined ? {} : {themeOutput: this.output}),
        version: state.version + 1,
      },
    };
  }
}
