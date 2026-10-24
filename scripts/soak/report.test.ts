import {describe, expect, it} from 'vitest';
import type {SoakVerdict} from './judge.mts';
import {formatReport} from './report.mts';

const passingVerdict: SoakVerdict = {
  passed: true,
  coveredMs: 3_600_000,
  longEnough: true,
  memory: [{name: 'main', trend: 'flat', baselinesKb: [204_800, 204_800]}],
  relaunches: [],
  fps: [{screen: 'main', medianFps: 60, lowestFps: 58.5, belowTarget: false}],
};

describe('formatReport', () => {
  it('reports a passing run', () => {
    expect(formatReport(passingVerdict, [])).toBe(
      [
        'Record covers 60.0 min.',
        'Memory (lowest private memory per window):',
        '  flat      main: 200.0 MB, 200.0 MB',
        'fps main: median 60.0, lowest 58.5',
        'Soak test passed.',
      ].join('\n'),
    );
  });

  it('reports why a run failed', () => {
    const report = formatReport(
      {
        ...passingVerdict,
        passed: false,
        coveredMs: 1_800_000,
        longEnough: false,
        memory: [{name: 'output:main', trend: 'unjudged', baselinesKb: []}],
        relaunches: [{name: 'output:main', count: 2}],
        fps: [
          {screen: 'main', medianFps: 41, lowestFps: 12, belowTarget: true},
        ],
      },
      [],
    );
    expect(report).toContain('Record covers 30.0 min (too short).');
    expect(report).toContain('  unjudged  output:main: too few samples');
    expect(report).toContain('Relaunched: output:main came back 2 times.');
    expect(report).toContain('Warning: fps main: median 41.0, lowest 12.0');
    expect(report).toMatch(/Soak test failed\.$/);
  });

  it('lists the first dropped lines and counts the rest', () => {
    const problems = Array.from({length: 12}, (_, index) => ({
      line: index + 1,
      reason: 'not JSON',
    }));
    const report = formatReport(passingVerdict, problems);
    expect(report).toContain('Dropped record lines (12):');
    expect(report).toContain('  line 10: not JSON');
    expect(report).not.toContain('  line 11: not JSON');
    expect(report).toContain('  ... and 2 more');
  });
});
