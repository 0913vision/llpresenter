import {createThemeId} from '@core/schema/ids';
import {afterEach, beforeEach, expect, it} from 'vitest';
import type {LiveCommand} from '@core/live/commands';
import {emptyLiveState, type SlideLayer} from '@core/live/state';
import {applyCommand, initialHistory} from '@main/live/reducer';
import {mockLlpApi} from '@fixtures/contracts/ipc/mockLlpApi';
import {sendMediaOutput, sendSlideOutput} from '@renderer/session/itemOutput';
import {useLive} from '@renderer/session/live';

const slide: SlideLayer = {
  itemId: 'first',
  position: 0,
  label: null,
  lines: ['Words'],
};
const background = {mediaId: 'same-video', loop: true};
let history = initialHistory(emptyLiveState());
let time = 1000;
const sent: LiveCommand[] = [];

beforeEach(() => {
  history = initialHistory(emptyLiveState());
  sent.length = 0;
  time = 1000;
  useLive.setState({
    state: emptyLiveState(),
    lastStartedItemId: null,
    commandVersion: 0,
  });
  window.llp = mockLlpApi({
    live: {
      send: command => {
        sent.push(command);
        history = applyCommand(history, command, time++);
      },
    },
  });
});
afterEach(() => {
  delete window.llp;
});

it('replaces an unrelated background with each source own choice atomically', () => {
  sendSlideOutput(slide, background);
  const startedAt = history.state.layers.media?.startedAt;
  sendSlideOutput({...slide, itemId: 'second'}, background);
  expect(history.state.layers.media?.startedAt).toBe(startedAt);
  sendSlideOutput({...slide, itemId: 'bible:passage'});
  expect(history.state.layers.media).toBeNull();
  expect(history.state.layers.slide?.itemId).toBe('bible:passage');
  expect(sent).toHaveLength(3);
  expect(sent[2]).toMatchObject({
    type: 'live.batch',
    commands: [
      {type: 'layer.clear', target: 'media'},
      {type: 'slide.show', slide: {itemId: 'bible:passage'}},
    ],
  });
  expect(useLive.getState().lastStartedItemId).toBe('bible:passage');
});

it('a direct media choice removes slide text while background-only commands keep it', () => {
  sendSlideOutput(slide);
  history = applyCommand(
    history,
    {type: 'media.show', media: background},
    time++,
  );
  expect(history.state.layers.slide).toEqual(slide);
  sendMediaOutput({...background, itemId: 'media:choice'});
  expect(history.state.layers.slide).toBeNull();
  expect(history.state.layers.media?.mediaId).toBe(background.mediaId);
  expect(sent.at(-1)).toEqual({
    type: 'live.batch',
    commands: [
      {type: 'layer.clear', target: 'slide'},
      {type: 'media.show', media: {...background, itemId: 'media:choice'}},
    ],
  });
  expect(useLive.getState().lastStartedItemId).toBe('media:choice');
});

it('keeps a background-only choice within its item and clears it at the next backgroundless item', () => {
  sendSlideOutput(slide, background);
  history = applyCommand(
    history,
    {type: 'media.show', media: {mediaId: 'macro-choice', loop: true}},
    time++,
  );
  const playing = history.state.layers.media;
  sendSlideOutput({...slide, position: 1}, background);
  expect(history.state.layers.media).toBe(playing);
  sendSlideOutput({...slide, itemId: 'next'});
  expect(history.state.layers.media).toBeNull();
});

it('restores the same item background when moving from its card to content', () => {
  const sectionCard = {
    name: 'Section',
    english: 'Section',
    theme: createThemeId('00000000-0000-4000-8000-000000000111'),
  };
  sendSlideOutput({...slide, sectionCard}, background);
  useLive.setState({state: history.state});
  sendSlideOutput({...slide, position: 1}, background);
  expect(sent.at(-1)).toMatchObject({
    type: 'live.batch',
    commands: [
      {type: 'media.show', media: background},
      {type: 'slide.show', slide: {position: 1}},
    ],
  });
});
