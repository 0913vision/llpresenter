import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {describe, expect, it} from 'vitest';
import type {LiveCommand} from '../../src/shared/commands';
import {parseLiveState} from '../../src/shared/schema/liveState';
import {LiveStore} from '../../src/main/live/store';
import {
  SliceRegistry,
  type SkippedLiveCommand,
} from '../../src/main/live/sliceRegistry';
import {batchSlice} from '../../src/main/live/slices/batch';
import {outputsSlice} from '../../src/main/live/slices/outputs';
import {heavyState, typicalState, uuid} from './liveFixtures';

const SAMPLES = 7;
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
    'measures dispatches, passing and failing 256-child batches, and the preload parser',
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
      const failingBatch: LiveCommand = {
        type: 'live.batch',
        commands: [
          ...Array.from({length: 255}, (_, i) => ({
            type: 'output.set' as const,
            screenId: 'main',
            on: i % 2 === 1,
          })),
          {type: 'output.set', screenId: uuid(999), on: true},
        ],
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
      const rejecting = new LiveStore(
        fixtures.heavy,
        () => 100,
        new SliceRegistry([outputsSlice, batchSlice]),
      );
      let rejections = 0;
      const countRejection = (problem: SkippedLiveCommand) => {
        if (problem.reason === 'invalid-overlay') rejections++;
      };
      results.push(
        measure('heavy:failingBatch256', 1, () => {
          rejecting.dispatch(failingBatch, undefined, countRejection);
        }),
      );
      expect(rejections).toBe(2 + SAMPLES);
      expect(rejecting.state.outputs).not.toHaveProperty(uuid(999));
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
        `.llp/live-admission-${phase}.json`,
        JSON.stringify(report, null, 2),
      );
    },
  );
});
