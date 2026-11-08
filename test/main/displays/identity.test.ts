import {describe, expect, it, vi, afterEach} from 'vitest';
import type {MonitorIdentity} from '@core/schema/monitorIdentity';
import {assignMonitors} from '@main/displays/assign';
import {
  IdentityDisplaySource,
  joinMonitorIdentities,
} from '@main/displays/identitySource';
import {
  displayInfo,
  MockDisplaySource,
  recordingLogger,
} from '@fixtures/main/displays/testing';
import {numberMonitors} from '@main/displays/monitor';

const identity = (serial: string, devicePath = serial): MonitorIdentity => ({
  kind: 'windows',
  devicePath,
  edid: {manufacturer: 'DEL', product: '1234', serial},
});
const left = {
  ...displayInfo({id: 2, x: 1920, name: 'Twin'}),
  identity: identity('LEFT'),
};
const right = {
  ...displayInfo({id: 3, x: 3840, name: 'Twin'}),
  identity: identity('RIGHT'),
};
const request = {screenId: 'main', display: left};
const inputs = {
  requests: [request],
  controlMonitorId: 1,
  previous: new Map([['main', 2]]),
};

describe('hardware assignment', () => {
  it.each([{identityUnknown: true}, {identityPending: true}])(
    'uses legacy matching for saved identities while metadata is unknown (%j)',
    state => {
      const current = {...left, ...state, identity: identity('OTHER')};
      expect(
        assignMonitors({...inputs, monitors: numberMonitors([current])}).get(
          'main',
        )?.id,
      ).toBe(2);
      const renumbered = {...current, id: 8};
      expect(
        assignMonitors({...inputs, monitors: numberMonitors([renumbered])}).get(
          'main',
        )?.id,
      ).toBe(8);
      expect(
        assignMonitors({
          ...inputs,
          controlMonitorId: 8,
          monitors: numberMonitors([renumbered]),
        }).size,
      ).toBe(0);
      expect(
        assignMonitors({
          ...inputs,
          requests: [request, {...request, screenId: 'stage'}],
          monitors: numberMonitors([current]),
        }).size,
      ).toBe(0);
    },
  );
  it('follows physical panels through reused IDs and changed ports', () => {
    const monitors = numberMonitors([
      {...left, id: 3, identity: identity('LEFT', 'new-left')},
      {...right, id: 2, identity: identity('RIGHT', 'new-right')},
    ]);
    const assigned = assignMonitors({
      ...inputs,
      monitors,
      requests: [request, {screenId: 'stage', display: right}],
    });
    expect(assigned.get('main')?.id).toBe(3);
    expect(assigned.get('stage')?.id).toBe(2);
  });
  it('never matches a lone look-alike, reused ID, previous ID or path after serial loss', () => {
    const replacement = {
      ...right,
      id: 2,
      bounds: left.bounds,
      identity: identity('OTHER', 'LEFT'),
    };
    expect(
      assignMonitors({...inputs, monitors: numberMonitors([replacement])}).size,
    ).toBe(0);
    const {identity: _removed, ...unreadable} = left;
    expect(
      assignMonitors({...inputs, monitors: numberMonitors([unreadable])}).size,
    ).toBe(0);
  });
  it('rejects duplicate serials and competing requests without falling back to paths', () => {
    expect(
      assignMonitors({
        ...inputs,
        monitors: numberMonitors([left, {...right, identity: left.identity}]),
      }).size,
    ).toBe(0);
    expect(
      assignMonitors({
        ...inputs,
        requests: [request, {...request, screenId: 'stage'}],
        monitors: numberMonitors([left]),
      }).size,
    ).toBe(0);
  });
  it('allows different proven panels to recover despite obsolete duplicate saved IDs', () => {
    const assigned = assignMonitors({
      ...inputs,
      monitors: numberMonitors([left, right]),
      requests: [request, {screenId: 'stage', display: {...right, id: 2}}],
    });
    expect(assigned.size).toBe(2);
  });
  it('uses a path only for a path-only assignment, never its stale ID', () => {
    const saved = {
      ...left,
      identity: {kind: 'windows', devicePath: 'LEFT'} as const,
    };
    const assigned = assignMonitors({
      ...inputs,
      requests: [{screenId: 'main', display: saved}],
      monitors: numberMonitors([{...left, id: 8}]),
    });
    expect(assigned.get('main')?.id).toBe(8);
    expect(
      assignMonitors({
        ...inputs,
        requests: [{screenId: 'main', display: saved}],
        monitors: numberMonitors([{...right, id: 2}]),
      }).size,
    ).toBe(0);
  });
  it('reserves a strong match before a legacy request and still identifies control conflicts', () => {
    const {identity: _removed, ...legacy} = left;
    const assigned = assignMonitors({
      ...inputs,
      controlMonitorId: 2,
      requests: [request, {screenId: 'legacy', display: legacy}],
      monitors: numberMonitors([left]),
    });
    expect([...assigned.keys()]).toEqual(['main']);
  });
  it.each([
    {width: 1920, height: 1080, dipWidth: 1280, dipHeight: 720},
    {width: 2560, height: 1440, dipWidth: 1706, dipHeight: 960},
  ])(
    'recovers changed IDs and scale using physical pixels (%s)',
    ({width, height, dipWidth, dipHeight}) => {
      const {identity: _removed, ...legacy} = left;
      const saved = {...legacy, bounds: {...legacy.bounds, width, height}};
      const current = {
        ...legacy,
        id: 8,
        scaleFactor: 1.5,
        bounds: {x: 3840, y: 0, width: dipWidth, height: dipHeight},
      };
      expect(
        assignMonitors({
          ...inputs,
          requests: [{screenId: 'main', display: saved}],
          monitors: numberMonitors([current]),
        }).get('main')?.id,
      ).toBe(8);
      expect(
        assignMonitors({
          ...inputs,
          requests: [{screenId: 'main', display: saved}],
          monitors: numberMonitors([{...current, scaleFactor: 2}]),
        }).size,
      ).toBe(0);
    },
  );
});

describe('async identity cache', () => {
  afterEach(() => vi.useRealTimers());
  const native = [{bounds: left.bounds, identity: left.identity}];
  it('refines a legacy match when a slow query locates the saved panel on another ID', async () => {
    vi.useFakeTimers();
    const raw = new MockDisplaySource(
      displayInfo({id: 2, x: 1920}),
      displayInfo({id: 3, x: 3840}),
    );
    let resolve: (value: typeof native) => void = () => undefined;
    const source = new IdentityDisplaySource({
      source: raw,
      query: () =>
        new Promise<typeof native>(done => {
          resolve = done;
        }),
      pixelBounds: entry => entry.bounds,
      log: recordingLogger(),
    });
    const stop = source.watch(vi.fn());
    const previous = new Map(inputs.previous);
    const assigned = () =>
      assignMonitors({
        ...inputs,
        previous,
        monitors: numberMonitors(source.read()),
      }).get('main')?.id;
    await vi.advanceTimersByTimeAsync(4000);
    expect(assigned()).toBe(2);
    resolve([
      {bounds: left.bounds, identity: right.identity},
      {bounds: right.bounds, identity: left.identity},
    ]);
    await vi.advanceTimersByTimeAsync(0);
    expect(assigned()).toBe(3);
    previous.set('main', 3);
    raw.emit();
    expect(source.read()[1]).toMatchObject({
      identityUnknown: true,
      identity: left.identity,
    });
    // NOTE(0913vision): The verified current ID wins over a reused saved ID.
    expect(assigned()).toBe(3);
    raw.change(displayInfo({id: 2, x: 1920}), displayInfo({id: 3, x: 5760}));
    expect(source.read()[1]?.identity).toBeUndefined();
    stop();
  });
  it('joins current pixel rectangles uniquely, refusing clones and overlaps', () => {
    const scaled = {
      ...left,
      scaleFactor: 1.5,
      bounds: {x: 1280, y: 0, width: 1280, height: 720},
    };
    expect(
      joinMonitorIdentities([scaled], native, () => left.bounds).get(2),
    ).toEqual(left.identity);
    expect(
      joinMonitorIdentities(
        [left],
        [...native, ...native],
        entry => entry.bounds,
      ).size,
    ).toBe(0);
    expect(
      joinMonitorIdentities(
        [left],
        [...native, {bounds: left.bounds}],
        entry => entry.bounds,
      ).size,
    ).toBe(0);
    expect(
      joinMonitorIdentities(
        [left, {...left, id: 3}],
        native,
        entry => entry.bounds,
      ).size,
    ).toBe(0);
  });
  it('never waits for the query during reads, caches it, and coalesces events', async () => {
    vi.useFakeTimers();
    const raw = new MockDisplaySource(displayInfo({id: 2, x: 1920}));
    const query = vi.fn(async () => native);
    const source = new IdentityDisplaySource({
      source: raw,
      query,
      pixelBounds: entry => entry.bounds,
      log: recordingLogger(),
    });
    const stop = source.watch(vi.fn());
    expect(source.read()[0]?.identityPending).toBe(true);
    expect(source.read()[0]?.identityUnknown).toBe(true);
    expect(query).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(0);
    expect(source.read()[0]?.identity).toEqual(left.identity);
    expect(source.read()[0]?.identityUnknown).toBe(false);
    source.read();
    source.read();
    await vi.advanceTimersByTimeAsync(1000);
    expect(query).toHaveBeenCalledTimes(1);
    raw.emit();
    raw.emit();
    await vi.advanceTimersByTimeAsync(299);
    expect(query).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(query).toHaveBeenCalledTimes(2);
    stop();
    expect(raw.watcherCount).toBe(0);
  });
  it('discards an old topology reply and cancels the active query on disposal', async () => {
    vi.useFakeTimers();
    let resolve: (value: typeof native) => void = () => undefined;
    let signal: AbortSignal | undefined;
    const raw = new MockDisplaySource(displayInfo({id: 2, x: 1920}));
    const query = vi.fn((next: AbortSignal) => {
      signal = next;
      return new Promise<typeof native>(done => {
        resolve = done;
      });
    });
    const source = new IdentityDisplaySource({
      source: raw,
      query,
      pixelBounds: entry => entry.bounds,
      log: recordingLogger(),
    });
    const listener = vi.fn();
    const stop = source.watch(listener);
    await vi.advanceTimersByTimeAsync(0);
    raw.emit();
    expect(signal?.aborted).toBe(true);
    resolve(native);
    await vi.advanceTimersByTimeAsync(300);
    expect(source.read()[0]?.identity).toBeUndefined();
    expect(query).toHaveBeenCalledTimes(2);
    stop();
    expect(signal?.aborted).toBe(true);
    resolve(native);
    await vi.advanceTimersByTimeAsync(1000);
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('finishes pending status after failure and does not poll or repeat warnings', async () => {
    vi.useFakeTimers();
    const raw = new MockDisplaySource(displayInfo({id: 2}));
    const query = vi.fn(async () => {
      throw new Error('unavailable');
    });
    const log = recordingLogger();
    const source = new IdentityDisplaySource({
      source: raw,
      query,
      pixelBounds: entry => entry.bounds,
      log,
    });
    const stop = source.watch(vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    expect(source.read()[0]?.identityPending).toBe(false);
    expect(source.read()[0]?.identityUnknown).toBe(true);
    expect(
      assignMonitors({...inputs, monitors: numberMonitors(source.read())}).get(
        'main',
      )?.id,
    ).toBe(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(query).toHaveBeenCalledTimes(1);
    raw.emit();
    await vi.advanceTimersByTimeAsync(300);
    expect(log.messages('warn')).toHaveLength(1);
    stop();
  });
});
