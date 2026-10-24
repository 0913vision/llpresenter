import {describe, expect, it} from 'vitest';
import type {LiveCommand} from '@shared/commands';
import {emptyLiveState, layerKinds, type SlideLayer} from '@shared/live';
import {applyCommand, initialHistory, type LiveHistory} from './reducer';

const RANDOM_COMMAND_COUNT = 5000;
const RANDOM_SEED = 20261024;

const slide = (position: number): SlideLayer => ({
  itemId: 'item-1',
  position,
  label: '후렴',
  lines: ['만복의 근원 하나님', '온 백성 찬송 드리고'],
});

const NEW_CONTENT: readonly LiveCommand[] = [
  {type: 'slide.show', slide: slide(5)},
  {type: 'media.show', media: {mediaId: 'still-water', loop: true}},
  {type: 'message.show', message: {messageId: 'parking', text: '차량 이동'}},
];

const run = (
  commands: readonly LiveCommand[],
  start: LiveHistory = initialHistory(emptyLiveState()),
): LiveHistory => commands.reduce(applyCommand, start);

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

function randomCommand(random: () => number): LiveCommand {
  const targets = [...layerKinds, 'all'] as const;
  const roll = random();
  if (roll < 0.3) {
    return {type: 'slide.show', slide: slide(Math.floor(random() * 9))};
  }
  if (roll < 0.4) {
    const mediaId = `m${Math.floor(random() * 3)}`;
    return {type: 'media.show', media: {mediaId, loop: true}};
  }
  if (roll < 0.5) {
    const message = {messageId: 'parking', text: '차량 이동 부탁드립니다'};
    return {type: 'message.show', message};
  }
  if (roll < 0.75) {
    const target = targets[Math.floor(random() * targets.length)] ?? 'all';
    return {type: 'layer.clear', target};
  }
  if (roll < 0.9) return {type: 'clear.undo'};
  const screenId = random() < 0.5 ? 'main' : 'stage';
  return {type: 'output.set', screenId, on: random() < 0.5};
}

describe('applyCommand', () => {
  it('shows a slide and bumps the version', () => {
    const next = run([{type: 'slide.show', slide: slide(1)}]);
    expect(next.state.version).toBe(1);
    expect(next.state.layers.slide?.position).toBe(1);
  });

  it('returns the same history when the same slide object is shown again', () => {
    const shown = slide(1);
    const once = run([{type: 'slide.show', slide: shown}]);
    expect(applyCommand(once, {type: 'slide.show', slide: shown})).toBe(once);
  });

  it('ignores clears of empty layers and records no undo', () => {
    const start = initialHistory(emptyLiveState());
    expect(applyCommand(start, {type: 'layer.clear', target: 'slide'})).toBe(
      start,
    );
    expect(applyCommand(start, {type: 'layer.clear', target: 'all'})).toBe(
      start,
    );
  });

  it('restores the layers from right before a clear on undo', () => {
    const shown = run([
      {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
      {type: 'slide.show', slide: slide(2)},
    ]);
    const cleared = applyCommand(shown, {type: 'layer.clear', target: 'all'});
    expect(layerKinds.every(kind => cleared.state.layers[kind] === null)).toBe(
      true,
    );
    const restored = applyCommand(cleared, {type: 'clear.undo'});
    expect(restored.state.layers).toEqual(shown.state.layers);
    expect(restored.undo).toBeNull();
    expect(restored.state.version).toBe(cleared.state.version + 1);
  });

  it('keeps other layers when one layer is cleared', () => {
    const shown = run([
      {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
      {type: 'slide.show', slide: slide(2)},
      {type: 'layer.clear', target: 'slide'},
    ]);
    expect(shown.state.layers.slide).toBeNull();
    expect(shown.state.layers.media?.mediaId).toBe('warm-light');
  });

  it('returns the same history when there is nothing to undo', () => {
    const start = initialHistory(emptyLiveState());
    expect(applyCommand(start, {type: 'clear.undo'})).toBe(start);
  });

  it('undoes only the last clear, one level deep', () => {
    const cleared = run([
      {type: 'media.show', media: {mediaId: 'warm-light', loop: true}},
      {type: 'slide.show', slide: slide(2)},
      {type: 'layer.clear', target: 'slide'},
      {type: 'layer.clear', target: 'media'},
    ]);
    const restored = applyCommand(cleared, {type: 'clear.undo'});
    expect(restored.state.layers.media?.mediaId).toBe('warm-light');
    expect(restored.state.layers.slide).toBeNull();
    expect(restored.undo).toBeNull();
  });

  it('does nothing on an undo right after an undo', () => {
    const restored = run([
      {type: 'slide.show', slide: slide(2)},
      {type: 'layer.clear', target: 'slide'},
      {type: 'clear.undo'},
    ]);
    expect(applyCommand(restored, {type: 'clear.undo'})).toBe(restored);
  });

  it.each(NEW_CONTENT)(
    'ends the undo when $type sends new content to any layer',
    content => {
      const cleared = run([
        {type: 'slide.show', slide: slide(2)},
        {type: 'layer.clear', target: 'slide'},
      ]);
      const changed = applyCommand(cleared, content);
      expect(changed.undo).toBeNull();
      expect(applyCommand(changed, {type: 'clear.undo'})).toBe(changed);
    },
  );

  it('keeps the undo when an output turns on or off', () => {
    const cleared = run([
      {type: 'slide.show', slide: slide(2)},
      {type: 'layer.clear', target: 'all'},
      {type: 'output.set', screenId: 'main', on: true},
    ]);
    const restored = applyCommand(cleared, {type: 'clear.undo'});
    expect(restored.state.layers.slide?.position).toBe(2);
  });

  it('keeps the undo when a clear finds nothing to clear', () => {
    const cleared = run([
      {type: 'slide.show', slide: slide(2)},
      {type: 'layer.clear', target: 'slide'},
    ]);
    expect(applyCommand(cleared, {type: 'layer.clear', target: 'notice'})).toBe(
      cleared,
    );
  });

  it('tracks output per screen and ignores repeated values', () => {
    const on = run([{type: 'output.set', screenId: 'main', on: true}]);
    expect(on.state.outputs['main']).toBe(true);
    expect(on.state.outputs['stage']).toBeUndefined();
    expect(
      applyCommand(on, {type: 'output.set', screenId: 'main', on: true}),
    ).toBe(on);
    const off = applyCommand(on, {
      type: 'output.set',
      screenId: 'main',
      on: false,
    });
    expect(off.state.outputs['main']).toBe(false);
  });

  it('never lowers the version or keeps an undo past new content for random commands', () => {
    const random = seededRandom(RANDOM_SEED);
    let history = initialHistory(emptyLiveState());
    for (let i = 0; i < RANDOM_COMMAND_COUNT; i += 1) {
      const command = randomCommand(random);
      const next = applyCommand(history, command);
      expect(next.state.version).toBeGreaterThanOrEqual(history.state.version);
      if (next !== history && command.type.endsWith('.show')) {
        expect(next.undo).toBeNull();
      }
      history = next;
    }
  });
});
