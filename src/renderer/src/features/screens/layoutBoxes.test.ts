import {describe, expect, it} from 'vitest';
import type {MonitorList} from '@core/schema/monitors';
import {displayLayout} from './layoutBoxes';
import {wideMonitorArrangement} from './testing/monitorArrangement';
import {
  CAPTIONS_ID,
  MAIN_ID,
  STAGE_ID,
  screensDocument,
} from './testing/documents';

function screens() {
  const document = screensDocument();
  if (document.name !== 'screens') throw new Error('Expected screens');
  return document.value.screens;
}

function monitor(number: number, x: number, hasMainWindow = false) {
  return {
    number,
    name: `Monitor ${number}`,
    bounds: {x, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow,
    screenIds: number === 2 ? [MAIN_ID] : [],
  };
}

const twoMonitors: MonitorList = [monitor(1, 0, true), monitor(2, 1920)];

describe('displayLayout', () => {
  it('places the boxes like the arrangement, in percent of the whole', () => {
    const model = displayLayout(twoMonitors, [], undefined);

    expect(model.aspectRatio).toBeCloseTo(3840 / 1080);
    expect(model.monitors.map(box => [box.left, box.width])).toEqual([
      [0, 50],
      [50, 50],
    ]);
    expect(model.monitors.map(box => [box.top, box.height])).toEqual([
      [0, 100],
      [0, 100],
    ]);
  });

  it('keeps a monitor left of or above the first inside the whole', () => {
    const model = displayLayout(
      [
        {
          ...monitor(1, -1920),
          bounds: {x: -1920, y: -1080, width: 1920, height: 1080},
        },
        monitor(2, 0),
      ],
      [],
      undefined,
    );

    expect(model.monitors.map(box => [box.left, box.top])).toEqual([
      [0, 0],
      [50, 50],
    ]);
  });

  it('shows the resolution, the name, and the control monitor', () => {
    const [first, second] = displayLayout(twoMonitors, [], undefined).monitors;

    expect(first).toMatchObject({
      resolution: '1920×1080',
      name: 'Monitor 1',
      control: true,
    });
    expect(second?.control).toBe(false);
  });

  it('lists the full screens that show on a monitor and marks the selected one', () => {
    const model = displayLayout(twoMonitors, screens(), MAIN_ID);

    expect(model.monitors.map(box => [box.screens, box.selected])).toEqual([
      [[], false],
      [['본 화면'], true],
    ]);
  });

  it('shows the assignment main reports, not the saved monitor', () => {
    const swapped: MonitorList = [
      {...monitor(1, 0, true), screenIds: [MAIN_ID]},
      {...monitor(2, 1920), screenIds: []},
    ];

    const model = displayLayout(swapped, screens(), MAIN_ID);

    expect(
      model.monitors.map(box => [box.number, box.screens, box.selected]),
    ).toEqual([
      [1, ['본 화면'], true],
      [2, [], false],
    ]);
  });

  it('shows the screen on no monitor when main assigned it none', () => {
    const model = displayLayout(
      [monitor(1, 0, true), {...monitor(2, 1920), screenIds: []}],
      screens(),
      MAIN_ID,
    );

    expect(model.monitors.flatMap(box => box.screens)).toEqual([]);
  });

  it('shows the resolution in device pixels while placing in device-independent pixels', () => {
    const scaled = {...monitor(1, 0, true), scaleFactor: 2};
    const model = displayLayout([scaled, monitor(2, 1920)], [], undefined);

    expect(model.monitors.map(box => box.resolution)).toEqual([
      '3840×2160',
      '1920×1080',
    ]);
    expect(model.monitors.map(box => box.width)).toEqual([50, 50]);
  });

  it('shows the default size of a capture window with no saved resolution', () => {
    const model = displayLayout(twoMonitors, screens(), undefined);

    expect(
      model.targets.find(target => target.id === CAPTIONS_ID)?.resolution,
    ).toBe('1920×1080');
  });

  it('keeps unassigned full screens selectable alongside separate windows', () => {
    const model = displayLayout(twoMonitors, screens(), CAPTIONS_ID);

    expect(model.targets.map(target => [target.id, target.selected])).toEqual([
      [CAPTIONS_ID, true],
      [STAGE_ID, false],
    ]);
    expect(model.targets.find(target => target.id === STAGE_ID)?.detail).toBe(
      '모니터 미지정',
    );
  });

  it('gives an empty layout for no monitors and still lists the targets', () => {
    const model = displayLayout([], screens(), undefined);

    expect(model.monitors).toEqual([]);
    expect(model.targets).toHaveLength(3);
  });

  it('keeps the exact wide-monitor aspect ratios and 222-pixel vertical offset', () => {
    const model = displayLayout(wideMonitorArrangement, screens(), MAIN_ID);
    const [primary, secondary] = model.monitors;
    if (primary === undefined || secondary === undefined) {
      throw new Error('Missing monitors');
    }
    expect(model.aspectRatio).toBeCloseTo(5360 / 1440);
    expect(primary.left).toBe(0);
    expect(primary.top).toBe(0);
    expect(secondary.left).toBeCloseTo(primary.width);
    expect(secondary.top).toBeCloseTo((222 / 1440) * 100);
    expect((primary.width / primary.height) * model.aspectRatio).toBeCloseTo(
      3440 / 1440,
    );
    expect(
      (secondary.width / secondary.height) * model.aspectRatio,
    ).toBeCloseTo(1920 / 1080);
    expect(secondary.screenIds).toEqual([MAIN_ID]);
  });
});
