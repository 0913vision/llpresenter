import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import type {ShowService} from '@shared/schema/showService';
import {fakeLlpApi} from '@shared/testing/fakeLlpApi';
import {
  applyService,
  openItem,
  startServiceSync,
  useShow,
} from '@renderer/state/show';

function serviceOf(overrides: Partial<ShowService> = {}): ShowService {
  return {
    revision: 1,
    id: 'sunday',
    name: '주일 예배',
    readOnly: false,
    rows: [
      {kind: 'header', id: 'praise', title: '찬양'},
      {kind: 'song', id: 'a', title: 'A'},
      {kind: 'song', id: 'b', title: 'B', problem: 'missing-song'},
    ],
    tiles: {
      a: [
        {label: '1절', labelColor: 'teal', lines: ['one']},
        {label: '후렴', labelColor: 'orange', lines: ['two']},
        {label: '2절', labelColor: 'teal', lines: ['three']},
      ],
    },
    jumpKeys: {KeyC: '후렴'},
    ...overrides,
  };
}

beforeEach(() => {
  applyService(null);
});

afterEach(() => {
  delete window.llp;
});

describe('applyService', () => {
  it('shows the rows, tiles, jump keys, name, and read-only flag', () => {
    applyService(serviceOf({readOnly: true}));
    expect(useShow.getState()).toMatchObject({
      revision: 1,
      serviceId: 'sunday',
      serviceName: '주일 예배',
      readOnly: true,
      jumpKeys: {KeyC: '후렴'},
    });
    expect(useShow.getState().rows).toHaveLength(3);
    expect(useShow.getState().tiles['a']).toHaveLength(3);
  });

  it('keeps the problem of a row', () => {
    applyService(serviceOf());
    expect(useShow.getState().rows.at(-1)).toMatchObject({
      problem: 'missing-song',
    });
  });

  it('drops a revision older than the one shown for the same service', () => {
    applyService(serviceOf({revision: 5, name: 'new'}));
    applyService(serviceOf({revision: 4, name: 'old'}));
    expect(useShow.getState()).toMatchObject({revision: 5, serviceName: 'new'});
  });

  it('takes the same revision and a newer one', () => {
    applyService(serviceOf({revision: 5}));
    applyService(serviceOf({revision: 5, name: 'same'}));
    applyService(serviceOf({revision: 6, name: 'next'}));
    expect(useShow.getState().serviceName).toBe('next');
  });

  it('takes another service even with a lower revision', () => {
    applyService(serviceOf({revision: 9}));
    applyService(serviceOf({revision: 1, id: 'other', name: 'other'}));
    expect(useShow.getState()).toMatchObject({
      serviceId: 'other',
      serviceName: 'other',
    });
  });

  it('keeps the open item and the selected tile when they are still there', () => {
    applyService(serviceOf());
    openItem('a');
    useShow.setState({selectedTile: 1});
    applyService(serviceOf({revision: 2}));
    expect(useShow.getState()).toMatchObject({
      openItemId: 'a',
      selectedTile: 1,
    });
  });

  it('moves the selected tile back inside a shorter item', () => {
    applyService(serviceOf());
    openItem('a');
    useShow.setState({selectedTile: 2});
    applyService(
      serviceOf({
        revision: 2,
        tiles: {a: [{label: null, labelColor: 'none', lines: ['x']}]},
      }),
    );
    expect(useShow.getState().selectedTile).toBe(0);
  });

  it('closes the open item when it is gone', () => {
    applyService(serviceOf());
    openItem('a');
    applyService(
      serviceOf({revision: 2, rows: [{kind: 'song', id: 'b', title: 'B'}]}),
    );
    expect(useShow.getState()).toMatchObject({
      openItemId: null,
      selectedTile: 0,
    });
  });

  it('empties everything when no service is open', () => {
    applyService(serviceOf());
    openItem('a');
    applyService(null);
    expect(useShow.getState()).toMatchObject({
      revision: null,
      serviceId: null,
      serviceName: '',
      readOnly: false,
      rows: [],
      tiles: {},
      jumpKeys: {},
      openItemId: null,
    });
  });

  it('accepts a service again after none was open', () => {
    applyService(serviceOf({revision: 8}));
    applyService(null);
    applyService(serviceOf({revision: 1}));
    expect(useShow.getState().revision).toBe(1);
  });
});

describe('startServiceSync', () => {
  it('does nothing outside Electron', () => {
    expect(() => startServiceSync()()).not.toThrow();
  });

  it('shows the service it reads and the ones that are pushed', async () => {
    let push: (service: ShowService | null) => void = () => undefined;
    window.llp = fakeLlpApi({
      service: {
        get: () => Promise.resolve(serviceOf({revision: 1})),
        subscribe: listener => {
          push = listener;
          return () => undefined;
        },
      },
    });
    startServiceSync();
    await vi.waitFor(() => expect(useShow.getState().revision).toBe(1));
    push(serviceOf({revision: 2, name: 'pushed'}));
    expect(useShow.getState().serviceName).toBe('pushed');
  });

  it('keeps a push that arrives before the read, and drops the older read', async () => {
    let push: (service: ShowService | null) => void = () => undefined;
    let answer: (service: ShowService | null) => void = () => undefined;
    window.llp = fakeLlpApi({
      service: {
        get: () =>
          new Promise(resolve => {
            answer = resolve;
          }),
        subscribe: listener => {
          push = listener;
          return () => undefined;
        },
      },
    });
    startServiceSync();
    push(serviceOf({revision: 3, name: 'pushed'}));
    answer(serviceOf({revision: 2, name: 'read'}));
    await Promise.resolve();
    await Promise.resolve();
    expect(useShow.getState().serviceName).toBe('pushed');
  });

  it('stops listening when the returned function is called', () => {
    const unsubscribe = vi.fn();
    window.llp = fakeLlpApi({service: {subscribe: () => unsubscribe}});
    startServiceSync()();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('logs a failed read and keeps what is shown', async () => {
    const write = vi.fn();
    window.llp = fakeLlpApi({
      service: {get: () => Promise.reject(new Error('no service'))},
      log: {write},
    });
    applyService(serviceOf());
    startServiceSync();
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write.mock.lastCall?.[0]).toMatchObject({level: 'error'});
    expect(useShow.getState().serviceName).toBe('주일 예배');
  });
});
