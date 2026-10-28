import {messageBlankNames} from '@shared/messageText';
import type {MacroActionKind} from '@shared/schema/macros';

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
const layers: readonly MacroTargetChoice[] = [
  {id: 'media', name: '미디어', clearTarget: 'layer'},
  {id: 'slide', name: '슬라이드', clearTarget: 'layer'},
  {id: 'prop', name: '소품', clearTarget: 'layer'},
  {id: 'audio', name: '오디오', clearTarget: 'layer'},
  {id: 'message', name: '메시지', clearTarget: 'layer'},
  {id: 'notice', name: '공지', clearTarget: 'layer'},
];

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
