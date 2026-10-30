import {describe, expect, it} from 'vitest';
import {buildMacroTargets, type MacroTargetSources} from './macroTargets';

const source: MacroTargetSources = {
  looks: {looks: [{id: 'look', name: 'Look'}]},
  layouts: {layouts: [{id: 'layout', name: 'Layout'}]},
  props: {props: [{id: 'prop-id', name: 'Prop'}]},
  messages: {
    templates: [
      {id: 'message', name: 'Message', text: '{name} {name} {place}'},
    ],
  },
  notices: {sets: [{id: 'notice', name: 'Notice'}]},
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
    expect(choices.look).toEqual([{id: 'look', name: 'Look'}]);
    expect(choices.stageLayout).toEqual([{id: 'layout', name: 'Layout'}]);
    expect(choices.media?.map(item => item.id)).toEqual(['image', 'video']);
    expect(choices.audio?.map(item => item.id)).toEqual(['audio']);
    expect(choices.audioPlaylist?.map(item => item.id)).toEqual(['playlist']);
    expect(choices.prop?.map(item => item.id)).toEqual(['prop-id']);
    expect(choices.notice?.map(item => item.id)).toEqual(['notice']);
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
      name: '소품',
      clearTarget: 'layer',
    });
    expect(targets.choices.clearLayer).toContainEqual({
      id: 'prop-id',
      name: 'Prop',
      clearTarget: 'prop',
    });
    expect(targets.screens.map(item => item.id)).toEqual(['audience', 'stage']);
    expect(targets.stageScreens.map(item => item.id)).toEqual(['stage']);
    expect(
      buildMacroTargets({
        ...source,
        props: {...source.props, props: []},
        screens: [],
      }).choices.clearLayer,
    ).toHaveLength(6);
  });

  it('names each layer as its 지우기 button does', () => {
    const layers = buildMacroTargets(source).choices.clearLayer?.filter(
      item => item.clearTarget === 'layer',
    );
    expect(layers?.map(item => item.name)).toEqual([
      '미디어',
      '가사',
      '소품',
      '오디오',
      '메시지',
      '공지',
    ]);
  });
});
