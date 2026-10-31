import {describe, expect, it, onTestFinished, vi} from 'vitest';
import type {
  ServiceDocument,
  SongDocument,
} from '@core/schema/contentDocuments';
import {createServiceId} from '@core/schema/ids';
import {SongEditorStore} from '@renderer/features/songs/editor';
import type {ItemProblem} from './itemEditQueue';
import {fixtureItems, fixtureServiceId, itemFixture} from './itemFixture';
import {ItemSourceFollower} from './itemSourceFollower';
function setup() {
  const fixture = itemFixture();
  const problem = vi.fn<ItemProblem>();
  const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const editor = new SongEditorStore(fixture.api, vi.fn());
  const source = new ItemSourceFollower(fixture.api, editor, {
    problem,
    accepted: vi.fn(),
  });
  source.start();
  onTestFinished(async () => {
    source.dispose();
    await editor.dispose();
  });
  return {...fixture, editor, source, problem, log};
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
describe('item source follower', () => {
  it('shows a song item with the song session, without opening the editor', async () => {
    const {source, editor, first} = setup();
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().song).not.toBeNull());
    const state = source.snapshot();
    expect(state.item?.id).toBe(fixtureItems.arranged);
    expect(state.song?.document.song.id).toBe(first.song.id);
    expect(editor.getSnapshot().session).toBeNull();
    expect(editor.sessionOf(first.song.id)).toBe(state.song);
  });

  it('reuses the session the editor already holds', async () => {
    const {api, source, editor, first} = setup();
    editor.open(first);
    const opened = editor.sessionOf(first.song.id);
    const get = vi.spyOn(api.songs, 'get');
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().item).not.toBeNull());
    expect(source.snapshot().song).toBe(opened);
    expect(get).not.toHaveBeenCalled();
  });

  it('follows newer pushes of its service only and drops older revisions', async () => {
    const {source, service, pushService} = setup();
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(source.snapshot().service).not.toBeNull());
    pushService(revised(service(), 9, '저녁 예배'));
    expect(source.snapshot().service?.service.name).toBe('저녁 예배');
    pushService(revised(service(), 4, '오래된 이름'));
    expect(source.snapshot().service?.service.name).toBe('저녁 예배');
    pushService({
      ...service(),
      revision: 10,
      service: {...service().service, order: []},
    });
    expect(source.snapshot().item).toBeNull();
  });

  it('drops a read that answers after another service was chosen', async () => {
    const {api, source, service} = setup();
    let answer: (document: ServiceDocument | null) => void = () => undefined;
    vi.spyOn(api.services, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    source.show(null);
    answer(service());
    await settle();
    expect(source.snapshot()).toMatchObject({service: null, item: null});
  });

  it('tells loading, ready, and missing songs apart, and nothing for other kinds', async () => {
    const {api, source, first} = setup();
    let answer: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().item).not.toBeNull());
    expect(source.snapshot()).toMatchObject({
      songStatus: 'loading',
      song: null,
    });
    answer(first);
    await vi.waitFor(() => expect(source.snapshot().songStatus).toBe('ready'));
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    expect(source.snapshot()).toMatchObject({
      songStatus: null,
    });
    vi.spyOn(api.songs, 'get').mockResolvedValueOnce(null);
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() =>
      expect(source.snapshot().songStatus).toBe('missing'),
    );
    expect(source.snapshot().song).toBeNull();
  });

  it('logs a failed song read and reads it again from 다시 불러오기', async () => {
    const {api, source, problem, log} = setup();
    const cause = new Error('Disk gone');
    vi.spyOn(api.songs, 'get').mockRejectedValueOnce(cause);
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().songStatus).toBe('failed'));
    expect(log).toHaveBeenCalledWith(expect.any(String), cause);
    const notice = problem.mock.calls.at(-1);
    expect(notice?.[0]).toBe('곡 불러오기 실패');
    notice?.[1]?.();
    expect(source.snapshot().songStatus).toBe('loading');
    await vi.waitFor(() => expect(source.snapshot().songStatus).toBe('ready'));
    expect(source.snapshot().song).not.toBeNull();
  });

  it('drops a song read that answers after another song item was shown', async () => {
    const {api, source, editor, first, second} = setup();
    let answer: (document: SongDocument | null) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().item).not.toBeNull());
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() =>
      expect(source.snapshot().song?.document.song.id).toBe(second.song.id),
    );
    answer(first);
    await settle();
    expect(editor.sessionOf(first.song.id)).toBeUndefined();
    expect(source.snapshot().song?.document.song.id).toBe(second.song.id);
  });

  it('ignores an old service notice retry while another service loads', async () => {
    const {api, source, problem, service} = setup();
    const otherId = createServiceId('40000000-0000-4000-8000-000000000002');
    const other: ServiceDocument = {
      ...service(),
      service: {...service().service, id: otherId, name: '저녁 예배'},
    };
    const get = vi.spyOn(api.services, 'get');
    get.mockRejectedValueOnce(new Error('Gone'));
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(problem).toHaveBeenCalled());
    const retry = problem.mock.calls[0]?.[1];
    let answer: (document: ServiceDocument | null) => void = () => undefined;
    get.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          answer = resolve;
        }),
    );
    source.show({serviceId: otherId, itemId: fixtureItems.slot});
    retry?.();
    answer(other);
    await vi.waitFor(() =>
      expect(source.snapshot().service?.service.id).toBe(otherId),
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('lets only the newest song read answer when song items alternate', async () => {
    const {api, source, problem, first} = setup();
    let fail: (reason: unknown) => void = () => undefined;
    vi.spyOn(api.songs, 'get').mockImplementationOnce(
      () =>
        new Promise((_, reject) => {
          fail = reject;
        }),
    );
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(source.snapshot().item).not.toBeNull());
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    await vi.waitFor(() => expect(source.snapshot().songStatus).toBe('ready'));
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() =>
      expect(source.snapshot().song?.document.song.id).toBe(first.song.id),
    );
    fail(new Error('Late failure'));
    await settle();
    expect(source.snapshot().songStatus).toBe('ready');
    expect(problem).not.toHaveBeenCalled();
  });

  it('reports a failed read with a retry that reads again', async () => {
    const {api, source, problem} = setup();
    vi.spyOn(api.services, 'get').mockRejectedValueOnce(new Error('Gone'));
    source.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(problem).toHaveBeenCalled());
    const notice = problem.mock.calls[0];
    expect(notice?.[0]).toBe('예배 순서 불러오기 실패');
    notice?.[1]?.();
    await vi.waitFor(() => expect(source.snapshot().item).not.toBeNull());
  });
});
