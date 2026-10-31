import type {ClearTarget} from '@core/live/commands';
import {messageBlankNames} from '@core/overlays/messageText';
import type {MacroActionKind} from '@core/schema/macros';
import {clearName} from '@renderer/ui/ClearButton';

export interface MacroTargetChoice {
  readonly id: string;
  readonly name: string;
  readonly clearTarget?: 'layer' | 'prop' | undefined;
  readonly blanks?: readonly string[] | undefined;
  readonly text?: string | undefined;
}

interface Named {
  readonly id: string;
  readonly name: string;
}

export interface MacroTargetSources {
  readonly themes: {readonly themes: readonly Named[]};
  readonly looks: {readonly looks: readonly Named[]};
  readonly layouts: {readonly layouts: readonly Named[]};
  readonly props: {readonly props: readonly Named[]};
  readonly messages: {
    readonly templates: ReadonlyArray<Named & {readonly text: string}>;
  };
  readonly notices: {readonly sets: readonly Named[]};
  readonly timers: {readonly timers: readonly Named[]};
  readonly macros: {readonly macros: readonly Named[]};
  readonly media: {
    readonly items: ReadonlyArray<
      Named & {readonly kind: 'audio' | 'video' | 'image'}
    >;
    readonly audioPlaylists: readonly Named[];
  };
  readonly screens: ReadonlyArray<
    Named & {readonly kind: 'stage' | 'audience'}
  >;
}
const CLEARED_LAYERS = [
  'slide',
  'media',
  'notice',
  'prop',
  'message',
  'audio',
] as const satisfies readonly ClearTarget[];

// NOTE(0913vision): A layer is named as on its 지우기 button, so the slide
// layer reads 가사 here too.
const layers: readonly MacroTargetChoice[] = CLEARED_LAYERS.map(target => ({
  id: target,
  name: clearName(target),
  clearTarget: 'layer',
}));

function choices(
  items: ReadonlyArray<{readonly id: string; readonly name: string}>,
): MacroTargetChoice[] {
  return items.map(({id, name}) => ({id, name}));
}

export function buildMacroTargets(source: MacroTargetSources): {
  readonly choices: Partial<
    Readonly<Record<MacroActionKind, readonly MacroTargetChoice[]>>
  >;
  readonly screens: readonly MacroTargetChoice[];
  readonly stageScreens: readonly MacroTargetChoice[];
} {
  return {
    choices: {
      theme: choices(source.themes.themes),
      look: choices(source.looks.looks),
      stageLayout: choices(source.layouts.layouts),
      clearLayer: [
        ...layers,
        ...source.props.props.map(({id, name}) => ({
          id,
          name,
          clearTarget: 'prop' as const,
        })),
      ],
      media: choices(source.media.items.filter(item => item.kind !== 'audio')),
      prop: choices(source.props.props),
      message: source.messages.templates.map(({id, name, text}) => ({
        id,
        name,
        blanks: messageBlankNames(text),
        text,
      })),
      notice: choices(source.notices.sets),
      audio: choices(source.media.items.filter(item => item.kind === 'audio')),
      audioPlaylist: choices(source.media.audioPlaylists),
      timer: choices(source.timers.timers),
      macro: choices(source.macros.macros),
    },
    screens: choices(source.screens),
    stageScreens: choices(
      source.screens.filter(screen => screen.kind === 'stage'),
    ),
  };
}
