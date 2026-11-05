import {describe, expect, it} from 'vitest';
import {
  buildMacroTargets,
  type MacroTargetSources,
} from '@renderer/features/tools/macroTargets';

const source: MacroTargetSources = {
  themes: {themes: [{id: 'theme', name: 'Theme'}]},
  props: {props: [{id: 'prop-id', name: 'Prop'}]},
  messages: {
    templates: [
      {id: 'message', name: 'Message', text: '{name} {name} {place}'},
    ],
  },
  timers: {timers: [{id: 'timer', name: 'Timer'}]},
  macros: {macros: [{id: 'macro', name: 'Macro'}]},
  media: {
    items: [
      {id: 'image', name: 'Image', kind: 'image'},
      {id: 'video', name: 'Video', kind: 'video'},
      {id: 'audio', name: 'Audio', kind: 'audio'},
    ],
    audioPlaylists: [{id: 'playlist', name: 'Playlist'}],
  },
  screens: [
    {id: 'audience', name: 'Audience', kind: 'audience'},
    {id: 'stage', name: 'Stage', kind: 'stage'},
  ],
};

describe('buildMacroTargets', () => {
  it('maps each action to its current targets, separating audio and visual media', () => {
    const {choices} = buildMacroTargets(source);
    expect(choices.theme).toEqual([{id: 'theme', name: 'Theme'}]);
    expect(choices.media?.map(item => item.id)).toEqual(['image', 'video']);
    expect(choices.audio?.map(item => item.id)).toEqual(['audio']);
    expect(choices.audioPlaylist?.map(item => item.id)).toEqual(['playlist']);
    expect(choices.prop?.map(item => item.id)).toEqual(['prop-id']);
    expect(choices.timer?.map(item => item.id)).toEqual(['timer']);
    expect(choices.macro?.map(item => item.id)).toEqual(['macro']);
    expect(choices.message).toEqual([
      {
        id: 'message',
        name: 'Message',
        blanks: ['name', 'place'],
        text: '{name} {name} {place}',
      },
    ]);
  });

  it('distinguishes clearing a layer from clearing a prop and filters stage screens', () => {
    const targets = buildMacroTargets(source);
    expect(targets.choices.clearLayer).toContainEqual({
      id: 'prop',
      name: '그래픽',
      clearTarget: 'layer',
    });
    expect(targets.choices.clearLayer).toContainEqual({
      id: 'prop-id',
      name: 'Prop',
      clearTarget: 'prop',
    });
    expect(targets.screens.map(item => item.id)).toEqual(['audience', 'stage']);
    expect(
      buildMacroTargets({
        ...source,
        props: {...source.props, props: []},
        screens: [],
      }).choices.clearLayer,
    ).toHaveLength(5);
  });
});
