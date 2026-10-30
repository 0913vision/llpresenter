import {writeFileSync} from 'node:fs';
import {cpus} from 'node:os';
import {performance} from 'node:perf_hooks';
import {describe, expect, it} from 'vitest';
import type {LiveState} from '../../src/core/live/state';
import {
  parseRecoveryRecord,
  serializeRecoveryRecord,
} from '../../src/core/schema/recoveryRecord';
import {heavyState, typicalState} from './liveFixtures';

const SAMPLES = 7;
const SAVED_AT = '2026-10-26T06:00:00+09:00';

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

function serialized(state: LiveState): string {
  const text = serializeRecoveryRecord({
    format: 'llrecovery',
    schemaVersion: 1,
    savedAt: SAVED_AT,
    serviceId: null,
    state,
  });
  if (!text.ok) throw new Error(text.error.message);
  return text.value;
}

describe('manual recovery record cost', () => {
  it.skipIf(process.env['LLP_RECOVERY_BENCH'] !== '1')(
    'measures one record write and one launch read',
    () => {
      const results = [];
      const sizes: Record<string, number> = {};
      for (const [name, state] of Object.entries({
        typical: typicalState(),
        heavy: heavyState(),
      })) {
        const iterations = name === 'typical' ? 500 : 5;
        const text = serialized(state);
        sizes[name] = Buffer.byteLength(text);
        results.push(
          measure(`${name}:serialize`, iterations, () => serialized(state)),
        );
        results.push(
          measure(`${name}:parse`, iterations, () => {
            if (!parseRecoveryRecord(text).ok) throw new Error('Invalid');
          }),
        );
      }
      expect(sizes['heavy']).toBeGreaterThan(3_000_000);
      writeFileSync(
        process.env['LLP_RECOVERY_BENCH_OUT'] ??
          '.llp/recovery-record-cost.json',
        JSON.stringify(
          {
            node: process.version,
            cpu: cpus()[0]?.model,
            samples: SAMPLES,
            bytes: sizes,
            results,
          },
          null,
          2,
        ),
      );
    },
  );
});
