import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {describe, expect, it} from 'vitest';
import type {LiveCommand} from '../../src/shared/commands';
import {emptyLiveState, type LiveState} from '../../src/shared/live';
import {parseLiveState} from '../../src/shared/schema/liveState';
import {LiveStore} from '../../src/main/live/store';
import {SliceRegistry} from '../../src/main/live/sliceRegistry';
import {batchSlice} from '../../src/main/live/slices/batch';
import {outputsSlice} from '../../src/main/live/slices/outputs';

const SAMPLES = 7;
const uuid = (index: number) =>
  `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;

function typicalState(): LiveState {
  return {
    ...emptyLiveState(),
    version: 10,
    outputs: {main: true, stage: true, broadcast: false},
    layers: {
      ...emptyLiveState().layers,
      media: {mediaId: 'invented-background', loop: true, startedAt: 100},
      slide: {
        itemId: 'invented-item',
        position: 0,
        label: 'Verse',
        lines: ['Invented morning light', 'Invented song of hope'],
      },
      message: {messageId: 'invented-message', text: 'Invented service cue'},
    },
  };
}

function heavyState(): LiveState {
  const value: unknown = {
    ...emptyLiveState(),
    version: 10,
    stageMessage: 'Invented stage cue',
    outputs: Object.fromEntries([
      ...Array.from({length: 200}, (_, i) => [uuid(i), true] as const),
      ...(['main', 'stage', 'broadcast', 'captions'] as const).map(
        id => [id, true] as const,
      ),
    ]),
    layers: {
      ...emptyLiveState().layers,
      media: {mediaId: 'invented-background', loop: true, startedAt: 100},
      slide: {
        itemId: 'invented-item',
        position: 0,
        label: 'Verse',
        lines: Array.from({length: 1000}, (_, i) =>
          `Invented line ${i}: ${'x'.repeat(3000)}`.slice(0, 3000),
        ),
      },
      message: {
        messageId: 'summary',
        text: '',
        items: Array.from({length: 200}, (_, i) => ({
          messageId: uuid(1000 + i),
          text: `Invented message ${i}: ${'y'.repeat(3000)}`.slice(0, 3000),
          targets: 'all',
          excludedTargets: [],
          startedAt: 100,
          expiresAt: null,
        })),
      },
      notice: {
        noticeId: 'invented-notice',
        playback: {
          media: Array.from({length: 512}, (_, i) => uuid(2000 + i)),
          position: 0,
          interval: 5,
          loop: true,
          targets: [uuid(0)],
          startedAt: 100,
          pausedAt: null,
        },
      },
    },
  };
  const parsed = parseLiveState(value);
  if (!parsed.ok) throw new Error(parsed.error.message);
  return parsed.value;
}

function measure(name: string, iterations: number, run: () => void) {
  for (let warmup = 0; warmup < 2; warmup++) run();
  const samples: number[] = [];
  for (let sample = 0; sample < SAMPLES; sample++) {
    const start = performance.now();
    for (let index = 0; index < iterations; index++) run();
    samples.push((performance.now() - start) / iterations);
  }
  samples.sort((a, b) => a - b);
  return {
    name,
    iterations,
    medianMs: samples[Math.floor(samples.length / 2)],
    minMs: samples[0],
    maxMs: samples.at(-1),
  };
}

describe('manual live admission cost', () => {
  it.skipIf(process.env['LLP_LIVE_BENCH'] !== '1')(
    'measures dispatches, 256-child batches, and the preload parser',
    () => {
      const results = [];
      const fixtures = {typical: typicalState(), heavy: heavyState()};
      const batch: LiveCommand = {
        type: 'live.batch',
        commands: Array.from({length: 256}, (_, i) => ({
          type: 'output.set',
          screenId: 'main',
          on: i % 2 === 1,
        })),
      };
      for (const [name, state] of Object.entries(fixtures)) {
        const store = new LiveStore(
          state,
          () => 100,
          new SliceRegistry([outputsSlice, batchSlice]),
        );
        let on = true;
        const dispatchIterations = name === 'typical' ? 500 : 3;
        const batchIterations = name === 'typical' ? 10 : 1;
        results.push(
          measure(`${name}:dispatch`, dispatchIterations, () => {
            on = !on;
            store.dispatch({type: 'output.set', screenId: 'main', on});
          }),
        );
        results.push(
          measure(`${name}:batch256`, batchIterations, () => {
            store.dispatch(batch);
          }),
        );
        results.push(
          measure(`${name}:preload`, name === 'typical' ? 500 : 3, () => {
            if (!parseLiveState(state).ok) throw new Error('Invalid fixture');
          }),
        );
        expect(parseLiveState(store.state).ok).toBe(true);
        expect(store.state.version).toBe(
          state.version + 4 + SAMPLES * (dispatchIterations + batchIterations),
        );
      }
      const phase = process.env['LLP_LIVE_BENCH_PHASE'] ?? 'unspecified';
      const report = {
        phase,
        node: process.version,
        cpu: cpus()[0]?.model,
        samples: SAMPLES,
        fixtureBytes: Object.fromEntries(
          Object.entries(fixtures).map(([name, state]) => [
            name,
            Buffer.byteLength(JSON.stringify({state}, null, 2)) + 1,
          ]),
        ),
        results,
      };
      writeFileSync(
        phase === 'round2-before'
          ? '.llp/data42-before-cost.json'
          : '.llp/data42-after-cost.json',
        JSON.stringify(report, null, 2),
      );
    },
  );
});
