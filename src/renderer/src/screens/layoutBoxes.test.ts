import {describe, expect, it} from 'vitest';
import type {MonitorList} from '@shared/schema/monitors';
import {displayLayout} from './layoutBoxes';
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
    id: number,
    number,
    name: `Monitor ${number}`,
    bounds: {x, y: 0, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow,
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

  it('finds the saved monitor by identity after the monitors are renumbered', () => {
    const left = {...monitor(1, 0, true), id: 5, name: 'Newly plugged'};
    const projector = {
      ...monitor(2, 1920),
      id: 2,
      number: 3,
      name: 'Projector',
    };
    const middle = {...monitor(3, 1000), id: 8, number: 2};
    const renumbered: MonitorList = [left, middle, projector];

    const model = displayLayout(renumbered, screens(), MAIN_ID);

    expect(
      model.monitors.map(box => [box.number, box.screens, box.selected]),
    ).toEqual([
      [1, [], false],
      [2, [], false],
      [3, ['본 화면'], true],
    ]);
  });

  it('shows the screen on no monitor when its saved monitor is gone', () => {
    const model = displayLayout([monitor(1, 0, true)], screens(), MAIN_ID);

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

    expect(model.targets.map(target => target.resolution)).toEqual([
      '1920×1080',
    ]);
  });

  it('puts screens without a monitor in the targets, and leaves an unassigned full screen out', () => {
    const model = displayLayout(twoMonitors, screens(), CAPTIONS_ID);

    expect(model.targets.map(target => [target.id, target.selected])).toEqual([
      [CAPTIONS_ID, true],
    ]);
    expect(model.targets.map(target => target.id)).not.toContain(STAGE_ID);
  });

  it('gives an empty layout for no monitors and still lists the targets', () => {
    const model = displayLayout([], screens(), undefined);

    expect(model.monitors).toEqual([]);
    expect(model.targets).toHaveLength(1);
  });
});
