import {describe, expect, it} from 'vitest';
import {assignMonitors, type SavedDisplay} from './assign';
import type {Monitor} from './monitor';
import {monitorById, monitorsOf} from './testing';

function savedFrom({id, name, bounds}: Monitor): SavedDisplay {
  return {id, name, bounds};
}

function assignedIds(
  map: ReadonlyMap<string, Monitor>,
): Record<string, number> {
  return Object.fromEntries([...map].map(([screen, {id}]) => [screen, id]));
}

describe('assignMonitors', () => {
  const control = {id: 1, primary: true, name: 'DELL U2720Q'};
  const projector = {id: 2, x: 1920, name: 'EPSON PJ'};
  const stage = {id: 3, x: 3840, name: 'LG TV'};
  const everything = monitorsOf(control, projector, stage);
  const savedProjector = monitorById(everything, 2);
  const savedStage = monitorById(everything, 3);

  it('matches by display id first, even when the name changed', () => {
    const monitors = monitorsOf(control, {...projector, name: 'Generic PnP'});
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedProjector)}],
      monitors,
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({main: 2});
  });

  it('matches by name and resolution when the id changed', () => {
    const monitors = monitorsOf(control, {...projector, id: 22, x: 3840});
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedProjector)}],
      monitors,
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({main: 22});
  });

  it('matches by position and resolution when the id and the name changed', () => {
    const monitors = monitorsOf(control, {...projector, id: 22, name: 'Other'});
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedProjector)}],
      monitors,
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({main: 22});
  });

  it('leaves a screen without a monitor when its monitor is unplugged', () => {
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedProjector)}],
      monitors: monitorsOf(control, stage),
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({});
  });

  it('never matches the control monitor loosely', () => {
    const twin = {...control, id: 7};
    const savedTwin = monitorById(monitorsOf({...twin, x: 1920}), 7);
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedTwin)}],
      monitors: monitorsOf(control),
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({});
  });

  it('keeps the control monitor for a screen saved on it by id', () => {
    const savedControl = monitorById(everything, 1);
    const assigned = assignMonitors({
      requests: [{screenId: 'main', display: savedFrom(savedControl)}],
      monitors: monitorsOf(control, projector),
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({main: 1});
  });

  it("never takes another screen's monitor loosely", () => {
    const lookAlike = {...savedFrom(savedProjector), id: 99, name: 'LG TV'};
    const assigned = assignMonitors({
      requests: [
        {screenId: 'main', display: lookAlike},
        {screenId: 'stage', display: savedFrom(savedStage)},
      ],
      monitors: monitorsOf(control, stage),
      controlMonitorId: 1,
    });
    expect(assignedIds(assigned)).toEqual({stage: 3});
  });
});
