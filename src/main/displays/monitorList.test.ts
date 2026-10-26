import {describe, expect, it} from 'vitest';
import {toMonitorList, type MonitorListInput} from './monitorList';
import {monitorsOf} from './testing';

const bounds = {x: 2000, y: 100, width: 800, height: 600};

function list(
  input: Partial<MonitorListInput> & Pick<MonitorListInput, 'monitors'>,
) {
  return toMonitorList({
    controlBounds: null,
    assignment: new Map(),
    limit: 64,
    ...input,
  });
}

describe('toMonitorList', () => {
  it('lists the monitors in number order with their details', () => {
    const monitors = monitorsOf(
      {id: 9, x: 1920, name: 'Projector', refreshRate: 50},
      {id: 4, primary: true, name: 'Desk'},
    );

    expect(list({monitors})).toEqual([
      {
        id: 4,
        number: 1,
        name: 'Desk',
        bounds: {x: 0, y: 0, width: 1920, height: 1080},
        scaleFactor: 1,
        refreshRate: 60,
        hasMainWindow: true,
        screenIds: [],
      },
      {
        id: 9,
        number: 2,
        name: 'Projector',
        bounds: {x: 1920, y: 0, width: 1920, height: 1080},
        scaleFactor: 1,
        refreshRate: 50,
        hasMainWindow: false,
        screenIds: [],
      },
    ]);
  });

  it('lists on each monitor the screens that main assigned to it', () => {
    const monitors = monitorsOf({id: 22, primary: true}, {id: 33, x: 1920});

    const result = list({
      monitors,
      assignment: new Map([
        ['main', 22],
        ['stage', 33],
        ['spare', 33],
        ['gone', 99],
      ]),
    });

    expect(result.map(monitor => monitor.screenIds)).toEqual([
      ['main'],
      ['stage', 'spare'],
    ]);
  });

  it('marks the monitor that holds the main window', () => {
    const monitors = monitorsOf({id: 1, primary: true}, {id: 2, x: 1920});

    const result = list({monitors, controlBounds: bounds});

    expect(result.map(monitor => monitor.hasMainWindow)).toEqual([false, true]);
  });

  it('marks the primary monitor when the main window is gone', () => {
    const monitors = monitorsOf({id: 1}, {id: 2, x: 1920, primary: true});

    const result = list({monitors});

    expect(result.map(monitor => monitor.hasMainWindow)).toEqual([false, true]);
  });

  it('stops at the limit and gives an empty list for no monitors', () => {
    const monitors = monitorsOf({id: 1}, {id: 2, x: 1920}, {id: 3, x: 3840});

    expect(list({monitors, limit: 2})).toHaveLength(2);
    expect(list({monitors: []})).toEqual([]);
  });
});
