import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {
  ServiceDocument,
  SongDocument,
} from '@shared/schema/contentDocuments';
import {createServiceId} from '@shared/schema/ids';
import {isItemOfKind} from '@shared/schema/service';
import {SongEditorStore} from '@renderer/prep/editor';
import type {Notice} from '@renderer/ui/notices';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {pendingWritesOf} from '@renderer/state/pendingWrites';
import {ServiceItemStore} from './serviceItemStore';

function setup() {
  const fixture = itemFixture();
  const problem = vi.fn<(notice: Notice) => void>();
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const items = new ServiceItemStore(fixture.api, editor, problem);
  onTestFinished(async () => {
    items.dispose();
    await editor.dispose();
  });
  return {...fixture, editor, items, problem, log};
}

async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn++) await Promise.resolve();
}

function revised(
  document: ServiceDocument,
  revision: number,
  name: string,
): ServiceDocument {
  return {...document, revision, service: {...document.service, name}};
}

describe('service item store', () => {
  it('shows a song item with the song session, without opening the editor', async () => {
    const {items, editor, first} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const state = items.getSnapshot();
    expect(state.item?.id).toBe(fixtureItems.arranged);
    expect(state.song?.document.song.id).toBe(first.song.id);
    expect(editor.getSnapshot().session).toBeNull();
    expect(editor.sessionOf(first.song.id)).toBe(state.song);
  });

  it('reuses the session the editor already holds', async () => {
    const {api, items, editor, first} = setup();
    editor.open(first);
    const opened = editor.sessionOf(first.song.id);
    const get = vi.spyOn(api.songs, 'get');
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(items.getSnapshot().song).toBe(opened);
    expect(get).not.toHaveBeenCalled();
  });

  it('follows newer pushes of its service only and drops older revisions', async () => {
    const {items, service, pushService} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(items.getSnapshot().service).not.toBeNull());
    pushService(revised(service(), 9, '저녁 예배'));
    expect(items.getSnapshot().service?.service.name).toBe('저녁 예배');
    pushService(revised(service(), 4, '오래된 이름'));
    expect(items.getSnapshot().service?.service.name).toBe('저녁 예배');
    pushService({
      ...service(),
      revision: 10,
      service: {...service().service, order: []},
    });
    expect(items.getSnapshot().item).toBeNull();
  });

  it('drops a read that answers after another service was chosen', async () => {
    const {api, items, service} = setup();
    let answer: (document: ServiceDocument | null) => void = () => undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    items.show(null);
    answer(service());
    await settle();
    expect(items.getSnapshot()).toMatchObject({service: null, item: null});
  });

  it('tells loading, ready, and missing songs apart, and nothing for other kinds', async () => {
    const {api, items, first} = setup();
    let answer: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(items.getSnapshot()).toMatchObject({
      songStatus: 'loading',
      song: null,
    });
    answer(first);
    await vi.waitFor(() =>
      expect(items.getSnapshot().songStatus).toBe('ready'),
    );
    expect(items.getSnapshot().arrangement).toBe('주일용');
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    expect(items.getSnapshot()).toMatchObject({
      songStatus: null,
      arrangement: undefined,
    });
    vi.spyOn(api.songs, 'get').mockResolvedValueOnce(null);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() =>
      expect(items.getSnapshot().songStatus).toBe('missing'),
    );
    expect(items.getSnapshot().song).toBeNull();
  });

  it('plays 기본 for a 구성 the song lost and keeps its order unchanged', async () => {
    const {items, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.lost});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(items.getSnapshot().arrangement).toBeUndefined();
    expect(items.setOrder([2, 1])).toBe(false);
    expect(edits).toEqual([]);
  });

  it('logs a failed song read and reads it again from 다시 불러오기', async () => {
    const {api, items, problem, log} = setup();
    const cause = new Error('Disk gone');
    vi.spyOn(api.songs, 'get').mockRejectedValueOnce(cause);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() =>
      expect(items.getSnapshot().songStatus).toBe('failed'),
    );
    expect(log).toHaveBeenCalledWith(expect.any(String), cause);
    const notice = problem.mock.calls.at(-1)?.[0];
    expect(notice?.title).toBe('곡 불러오기 실패');
    notice?.actions?.[0]?.onSelect();
    expect(items.getSnapshot().songStatus).toBe('loading');
    await vi.waitFor(() =>
      expect(items.getSnapshot().songStatus).toBe('ready'),
    );
    expect(items.getSnapshot().song).not.toBeNull();
  });

  it('drops a song read that answers after another song item was shown', async () => {
    const {api, items, editor, first, second} = setup();
    let answer: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() =>
      expect(items.getSnapshot().song?.document.song.id).toBe(second.song.id),
    );
    answer(first);
    await settle();
    expect(editor.sessionOf(first.song.id)).toBeUndefined();
    expect(items.getSnapshot().song?.document.song.id).toBe(second.song.id);
  });

  it('ignores an old service notice retry while another service loads', async () => {
    const {api, items, problem, service} = setup();
    const otherId = createServiceId('40000000-0000-4000-8000-000000000002');
    const other: ServiceDocument = {
      ...service(),
      service: {...service().service, id: otherId, name: '저녁 예배'},
    };
    const get = vi.spyOn(api.services, 'get');
    get.mockRejectedValueOnce(new Error('Gone'));
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(problem).toHaveBeenCalled());
    const retry = problem.mock.calls[0]?.[0].actions?.[0];
    let answer: (document: ServiceDocument | null) => void = () => undefined;
    get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    items.show({serviceId: otherId, itemId: fixtureItems.slot});
    retry?.onSelect();
    answer(other);
    await vi.waitFor(() =>
      expect(items.getSnapshot().service?.service.id).toBe(otherId),
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lets only the newest song read answer when song items alternate', async () => {
    const {api, items, problem, first} = setup();
    let fail: (reason: unknown) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() =>
      expect(items.getSnapshot().songStatus).toBe('ready'),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() =>
      expect(items.getSnapshot().song?.document.song.id).toBe(first.song.id),
    );
    fail(new Error('Late failure'));
    await settle();
    expect(items.getSnapshot().songStatus).toBe('ready');
    expect(problem).not.toHaveBeenCalled();
  });

  it('reports a failed read with a retry that reads again', async () => {
    const {api, items, problem} = setup();
    vi.spyOn(api.services, 'get').mockRejectedValueOnce(new Error('Gone'));
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(problem).toHaveBeenCalled());
    const notice = problem.mock.calls[0]?.[0];
    expect(notice?.title).toBe('예배 순서 불러오기 실패');
    notice?.actions?.[0]?.onSelect();
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
  });

  it('chooses a 구성 and 기본 on the item and keeps its other fields', async () => {
    const {items, service, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(await items.chooseArrangement(undefined)).toBe(true);
    const item = service().service.order[1];
    expect(item).toEqual({
      id: fixtureItems.arranged,
      song: items.getSnapshot().song?.document.song.id,
      memo: '천천히',
      future: {keep: true},
    });
    expect(items.getSnapshot().item).toEqual(item);
    expect(await items.chooseArrangement('주일용')).toBe(true);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      2,
    );
    const chosen = items.getSnapshot().item;
    expect(
      chosen !== null && isItemOfKind(chosen, 'song') && chosen.arrangement,
    ).toBe('주일용');
  });

  it('waits for a running edit at the close flush and refuses new ones until it resumes', async () => {
    const {api, items, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const read = api.services.get.bind(api.services);
    let answer: () => void = () => undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      id =>
        new Promise(resolve => {
          answer = () => {
            resolve(read(id));
          };
        }),
    );
    const choosing = items.chooseArrangement(undefined);
    let flushed = false;
    const writes = pendingWritesOf(api);
    const flushing = writes.flush().then(sent => {
      flushed = true;
      return sent;
    });
    await settle();
    expect(flushed).toBe(false);
    expect(items.getSnapshot().busy).toBe(true);
    answer();
    expect(await flushing).toBe(true);
    expect(await choosing).toBe(true);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      1,
    );
    expect(await items.chooseArrangement('주일용')).toBe(false);
    expect(await items.createArrangement()).toBe(false);
    expect(items.setOrder([1])).toBe(false);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      1,
    );
    writes.resume();
    expect(items.getSnapshot().busy).toBe(false);
    expect(await items.chooseArrangement('주일용')).toBe(true);
  });

  it('refuses a 구성 for other kinds and reports main refusals', async () => {
    const {api, items, problem, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(await items.chooseArrangement('주일용')).toBe(false);
    expect(edits).toEqual([]);
    expect(problem).toHaveBeenLastCalledWith(
      expect.objectContaining({title: '구성 변경 실패'}),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk full',
        applied: {id: fixtureServiceId, revision: 4},
        unchangedFiles: ['invented.llservice'],
      },
    });
    expect(await items.chooseArrangement('주일용')).toBe(true);
    expect(problem).toHaveBeenLastCalledWith(
      expect.objectContaining({title: '예배 순서 저장 실패'}),
    );
  });

  it('runs one item edit at a time', async () => {
    const {items, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    const first = items.chooseArrangement(undefined);
    expect(items.getSnapshot().busy).toBe(true);
    expect(await items.chooseArrangement(undefined)).toBe(false);
    expect(await first).toBe(true);
    expect(items.getSnapshot().busy).toBe(false);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      1,
    );
  });

  it('saves a new order of the chosen 구성 in the song as one undo step', async () => {
    const {items, documents, first, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const session = items.getSnapshot().song;
    expect(items.setOrder([2, 1, 2])).toBe(true);
    expect(items.setOrder([2, 1, 2])).toBe(false);
    await session?.flush();
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [2, 1, 2]},
    ]);
    expect(edits.at(-1)?.type).toBe('song.update');
    session?.edit('undo');
    await session?.flush();
    expect(documents.get(first.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [1, 2, 2]},
    ]);
  });

  it('keeps 기본, missing 구성, and invalid 슬라이드 numbers unchanged', async () => {
    const {items, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(items.setOrder([2, 1])).toBe(false);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    for (const slides of [[0], [3], [1.5]]) {
      expect(items.setOrder(slides)).toBe(false);
    }
    expect(edits).toEqual([]);
  });

  it('copies the file order of 기본 into 새 구성 and picks it', async () => {
    const {items, documents, second, service} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(await items.createArrangement()).toBe(true);
    expect(documents.get(second.song.id)?.song.arrangements).toEqual([
      {name: '주일용', slides: [1, 2, 2]},
      {name: '구성 1', slides: [1, 2]},
    ]);
    expect(service().service.order[2]).toMatchObject({arrangement: '구성 1'});
    expect(items.getSnapshot().arrangement).toBe('구성 1');
  });

  it('picks 새 구성 for the item it was made for after the selection moved', async () => {
    const {api, items, service, first, documents} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    const write = api.content.edit;
    let release: () => void = () => undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    const creating = items.createArrangement();
    await vi.waitFor(() =>
      expect(documents.get(first.song.id)?.song.arrangements).toHaveLength(2),
    );
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    release();
    expect(await creating).toBe(true);
    expect(service().service.order[1]).toMatchObject({arrangement: '구성 1'});
    expect(service().service.order[2]).not.toHaveProperty('arrangement');
  });

  it('makes no 새 구성 for a read-only song', async () => {
    const {items, documents, first, edits} = setup();
    documents.set(first.song.id, {...first, access: 'readOnly'});
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(await items.createArrangement()).toBe(false);
    expect(edits).toEqual([]);
  });

  it('refuses order edits of a read-only song', async () => {
    const {items, documents, first} = setup();
    documents.set(first.song.id, {...first, access: 'readOnly'});
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(items.setOrder([2, 1, 2])).toBe(false);
  });

  it('shares one selected place and starts over for another item', async () => {
    const {items} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    items.selectPosition(2);
    expect(items.getSnapshot().position).toBe(2);
    for (const invalid of [-1, 1.5]) items.selectPosition(invalid);
    expect(items.getSnapshot().position).toBe(2);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    expect(items.getSnapshot().position).toBe(0);
  });

  it('releases its subscriptions and ignores pushes after dispose', async () => {
    const {items, serviceListeners, service, pushService} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(serviceListeners()).toBe(1);
    const before = items.getSnapshot();
    items.dispose();
    expect(serviceListeners()).toBe(0);
    pushService(revised(service(), 20, '다른 이름'));
    expect(items.getSnapshot()).toBe(before);
  });
});
