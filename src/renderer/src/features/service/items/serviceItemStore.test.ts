import {fixtureMedia} from '@core/testing/mediaList';
import type {ServiceDocument} from '@core/schema/contentDocuments';
import {describe, expect, it, onTestFinished, vi} from 'vitest';
import {isItemOfKind} from '@core/schema/service';
import {SongEditorStore} from '@renderer/features/songs/editor';
import type {Notice} from '@renderer/ui/notices';
import {pendingWritesOf} from '@renderer/platform/pendingWrites';
import {
  fixtureItems,
  fixtureMacros,
  fixtureServiceId,
  itemFixture,
} from './itemFixture';
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
  it('plays 기본 for a 구성 the song lost and keeps its order unchanged', async () => {
    const {items, edits} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(items.getSnapshot().arrangement).toBe('주일용');
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.lost});
    await vi.waitFor(() => expect(items.getSnapshot().song).not.toBeNull());
    expect(items.getSnapshot().arrangement).toBeUndefined();
    expect(edits).toEqual([]);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    expect(items.getSnapshot()).toMatchObject({arrangement: undefined});
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
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      1,
    );
    writes.resume();
    expect(items.getSnapshot().busy).toBe(false);
    expect(await items.chooseArrangement('주일용')).toBe(true);
  });

  it('saves a memo queued behind a running edit before a close flush succeeds', async () => {
    const {api, items, service} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    const write = api.content.edit;
    let release: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
    const choosing = items.chooseArrangement(undefined);
    const saving = items.setMemo(target, '닫기 전에');
    const flushing = pendingWritesOf(api).flush();
    await vi.waitFor(() => expect(release).toBeDefined());
    release?.();
    expect(await flushing).toBe(true);
    expect(await choosing).toBe(true);
    expect(await saving).toBe(true);
    expect(service().service.order[1]).toMatchObject({memo: '닫기 전에'});
    expect(items.memoDraft(target)).toBeUndefined();
  });

  it('applies a queued edit to the item it was asked for after the selection moved', async () => {
    const {api, items, service} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    const write = api.content.edit;
    let release: (() => void) | undefined;
    vi.spyOn(api.content, 'edit').mockImplementationOnce(async edit => {
      const result = await write(edit);
      return new Promise(resolve => {
        release = () => resolve(result);
      });
    });
    const holding = items.setStartMacro(fixtureMacros.sermon);
    await vi.waitFor(() => expect(release).toBeDefined());
    const background = items.setBackground(fixtureMedia.warm);
    const choosing = items.chooseArrangement(undefined);
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.plain});
    release?.();
    expect(await holding).toBe(true);
    expect(await background).toBe(true);
    expect(await choosing).toBe(true);
    expect(service().service.order[1]).toMatchObject({
      macro: fixtureMacros.sermon,
      background: fixtureMedia.warm,
    });
    expect(service().service.order[1]).not.toHaveProperty('arrangement');
    const other = service().service.order[2];
    expect(other).toHaveProperty('id', fixtureItems.plain);
    for (const field of ['macro', 'background']) {
      expect(other).not.toHaveProperty(field);
    }
  });

  it('makes the close flush save a draft that a refused save left waiting', async () => {
    const {api, items, service} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    const write = api.content.edit;
    vi.spyOn(api.content, 'edit').mockResolvedValue({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
    expect(await items.setMemo(target, '남은 글')).toBe(false);
    expect(items.memoDraft(target)).toBe('남은 글');
    expect(await items.flushDrafts()).toBe(false);
    expect(items.memoDraft(target)).toBe('남은 글');
    vi.mocked(api.content.edit).mockImplementation(write);
    expect(await items.flushDrafts()).toBe(true);
    expect(items.memoDraft(target)).toBeUndefined();
    expect(service().service.order[1]).toMatchObject({memo: '남은 글'});
    expect(await items.flushDrafts()).toBe(true);
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

  it('sets and removes the background, start 매크로, and memo of a song item', async () => {
    const {items, service} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
    expect(await items.setBackground(fixtureMedia.warm)).toBe(true);
    expect(await items.setStartMacro(fixtureMacros.praise)).toBe(true);
    expect(await items.setMemo(target, '새 메모')).toBe(true);
    expect(service().service.order[1]).toMatchObject({
      background: fixtureMedia.warm,
      macro: fixtureMacros.praise,
      memo: '새 메모',
      future: {keep: true},
    });
    expect(await items.setBackground(null)).toBe(true);
    expect(await items.setStartMacro(undefined)).toBe(true);
    expect(await items.setMemo(target, '')).toBe(true);
    for (const field of ['background', 'macro', 'memo']) {
      expect(service().service.order[1]).not.toHaveProperty(field);
    }
  });

  it('refuses a start 매크로 and a memo for headers and slots', async () => {
    const {items, edits, problem} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.slot});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    expect(await items.setStartMacro(fixtureMacros.praise)).toBe(false);
    expect(
      await items.setMemo(
        {serviceId: fixtureServiceId, itemId: fixtureItems.header},
        '메모',
      ),
    ).toBe(false);
    expect(edits).toEqual([]);
    expect(problem).toHaveBeenCalledTimes(2);
  });

  it('drops the draft of an item that was deleted', async () => {
    const {api, items, service, pushService} = setup();
    items.show({serviceId: fixtureServiceId, itemId: fixtureItems.arranged});
    await vi.waitFor(() => expect(items.getSnapshot().item).not.toBeNull());
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
    await items.setMemo(target, '남는 글');
    expect(items.memoDraft(target)).toBe('남는 글');
    pushService({
      ...service(),
      revision: 30,
      service: {
        ...service().service,
        order: service().service.order.filter(
          row => row.id !== fixtureItems.arranged,
        ),
      },
    });
    expect(items.memoDraft(target)).toBeUndefined();
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
