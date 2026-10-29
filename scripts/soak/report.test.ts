import {describe, expect, it} from 'vitest';
import type {SoakVerdict} from './judge.mts';
import {formatReport} from './report.mts';

const passingVerdict: SoakVerdict = {
  passed: true,
  coveredMs: 3_600_000,
  longEnough: true,
  memory: [
    {
      name: 'main',
      trend: 'flat',
      baselinesKb: [204_800, 204_800],
      growthKbPerHour: 0,
    },
  ],
  relaunches: [],
  fps: [{screen: 'main', medianFps: 60, lowestFps: 58.5, belowTarget: false}],
};

describe('formatReport', () => {
  it('reports a passing run', () => {
    expect(formatReport(passingVerdict, [])).toBe(
      [
        'Record covers 60.0 min.',
        'Memory (rise per hour, then the lowest private memory per window):',
        '  flat      main: +0.0 MB/h (200.0 MB, 200.0 MB)',
        'fps main: median 60.0, lowest 58.5',
        'Soak test passed.',
      ].join('\n'),
    );
  });

  it('shows a reported-only process with its growth', () => {
    const report = formatReport(
      {
        ...passingVerdict,
        memory: [
          {
            name: 'gpu',
            trend: 'reported',
            baselinesKb: [409_600, 419_840],
            growthKbPerHour: 10_240,
          },
        ],
      },
      [],
    );
    expect(report).toContain(
      '  reported  gpu: +10.0 MB/h (400.0 MB, 410.0 MB)',
    );
    expect(report).toContain('Soak test passed.');
  });

  it('reports why a run failed', () => {
    const report = formatReport(
      {
        ...passingVerdict,
        passed: false,
        coveredMs: 1_800_000,
        longEnough: false,
        memory: [
          {
            name: 'output:main',
            trend: 'unjudged',
            baselinesKb: [],
            growthKbPerHour: null,
          },
          {
            name: 'gpu',
            trend: 'growing',
            baselinesKb: [250_000, 262_288],
            growthKbPerHour: 12_288,
          },
        ],
        relaunches: [{name: 'output:main', count: 2}],
        fps: [
          {screen: 'main', medianFps: 41, lowestFps: 12, belowTarget: true},
        ],
      },
      [],
    );
    expect(report).toContain('Record covers 30.0 min (too short).');
    expect(report).toContain('  unjudged  output:main: too few samples');
    expect(report).toContain(
      '  growing   gpu: +12.0 MB/h (244.1 MB, 256.1 MB)',
    );
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
