import {describe, expect, it} from 'vitest';
import {
  assignMonitors,
  type AssignmentInput,
  type DisplayRequest,
  type SavedDisplay,
} from './assign';
import type {Monitor} from './monitor';
import {monitorById, monitorsOf, type DisplaySpec} from './testing';

function savedFrom({id, name, bounds}: Monitor): SavedDisplay {
  return {id, name, bounds};
}

function assignedIds(
  map: ReadonlyMap<string, Monitor>,
): Record<string, number> {
  return Object.fromEntries([...map].map(([screen, {id}]) => [screen, id]));
}

function assign(
  requests: readonly DisplayRequest[],
  specs: readonly DisplaySpec[],
  previous: AssignmentInput<Monitor>['previous'] = new Map(),
): Record<string, number> {
  return assignedIds(
    assignMonitors({
      requests,
      monitors: monitorsOf(...specs),
      controlMonitorId: 1,
      previous,
    }),
  );
}

describe('assignMonitors', () => {
  const control = {id: 1, primary: true, name: 'DELL U2720Q'};
  const projector = {id: 2, x: 1920, name: 'EPSON PJ'};
  const stage = {id: 3, x: 3840, name: 'LG TV'};
  const everything = monitorsOf(control, projector, stage);
  const onProjector = {
    screenId: 'main',
    display: savedFrom(monitorById(everything, 2)),
  };
  const onStage = {
    screenId: 'stage',
    display: savedFrom(monitorById(everything, 3)),
  };

  it('matches by display id first, even when the name changed', () => {
    expect(
      assign([onProjector], [control, {...projector, name: 'Generic PnP'}]),
    ).toEqual({main: 2});
  });

  it('matches by name and resolution when the id changed', () => {
    expect(
      assign([onProjector], [control, {...projector, id: 22, x: 3840}]),
    ).toEqual({main: 22});
  });

  it('matches by position and resolution when the id and the name changed', () => {
    expect(
      assign([onProjector], [control, {...projector, id: 22, name: 'Other'}]),
    ).toEqual({main: 22});
  });

  it('keeps a screen on the monitor it had last time when the ids change', () => {
    const moved = {...projector, id: 22, x: 3840, name: 'Other'};
    expect(
      assign([onProjector], [control, moved], new Map([['main', 22]])),
    ).toEqual({main: 22});
  });

  it('leaves a screen without a monitor when its monitor is unplugged', () => {
    expect(assign([onProjector], [control, stage])).toEqual({});
  });

  it('never matches the control monitor loosely', () => {
    const twin = monitorById(monitorsOf({...control, id: 7, x: 1920}), 7);
    expect(
      assign([{screenId: 'main', display: savedFrom(twin)}], [control]),
    ).toEqual({});
  });

  it('keeps the control monitor for a screen saved on it by id', () => {
    const onControl = {
      screenId: 'main',
      display: savedFrom(monitorById(everything, 1)),
    };
    expect(assign([onControl], [control, projector])).toEqual({main: 1});
  });

  it("never takes another screen's monitor loosely", () => {
    const lookAlike = {
      screenId: 'main',
      display: {...onProjector.display, id: 99, name: 'LG TV'},
    };
    expect(assign([lookAlike, onStage], [control, stage])).toEqual({stage: 3});
  });

  describe('two monitors of the same model', () => {
    const left = {id: 2, x: 1920, name: 'Generic PnP'};
    const right = {id: 3, x: 3840, name: 'Generic PnP'};
    const twins = monitorsOf(control, left, right);
    const mainOnLeft = {
      screenId: 'main',
      display: savedFrom(monitorById(twins, 2)),
    };
    const stageOnRight = {
      screenId: 'stage',
      display: savedFrom(monitorById(twins, 3)),
    };

    it('leaves the other output on its monitor when one is unplugged after the ids changed', () => {
      const rightWithNewId = {...right, id: 33};
      expect(
        assign([mainOnLeft, stageOnRight], [control, rightWithNewId]),
      ).toEqual({stage: 33});
    });

    it('keeps each output on the monitor it had when the ids change while plugged in', () => {
      const previous = new Map([
        ['main', 22],
        ['stage', 33],
      ]);
      const swapped = [
        control,
        {...left, id: 22, x: 3840},
        {...right, id: 33, x: 1920},
      ];
      expect(assign([mainOnLeft, stageOnRight], swapped, previous)).toEqual({
        main: 22,
        stage: 33,
      });
    });

    it('leaves both outputs without a monitor when nothing tells them apart', () => {
      const moved = [
        control,
        {...left, id: 22, y: 1080},
        {...right, id: 33, y: 1080},
      ];
      expect(assign([mainOnLeft, stageOnRight], moved)).toEqual({});
    });

    it('rejects a monitor two screens saved with the same position', () => {
      const sameSpot = {
        screenId: 'stage',
        display: {...mainOnLeft.display, id: 44},
      };
      expect(
        assign(
          [{...mainOnLeft, display: {...mainOnLeft.display, id: 55}}, sameSpot],
          [control, {...left, id: 22, name: 'Other'}],
        ),
      ).toEqual({});
    });
  });
});
