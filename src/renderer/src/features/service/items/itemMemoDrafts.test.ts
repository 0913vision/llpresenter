import {fixtureMedia} from '@core/testing/mediaList';
import {describe, expect, it, vi} from 'vitest';
import {createServiceItemId} from '@core/schema/ids';
import {fixtureItems, fixtureServiceId} from './itemFixture';
import {itemEditFixture} from './itemEditTesting';
import {arrangementRequest, backgroundRequest} from './itemPlaybackCommands';
import {ItemMemoDrafts} from './itemMemoDrafts';
function setup() {
  const fixture = itemEditFixture();
  const memos = new ItemMemoDrafts(fixture.queue, vi.fn(), fixture.problem);
  return {...fixture, memos};
}
describe('item memo drafts', () => {
  it('keeps a memo save that overlaps a background change instead of refusing it', async () => {
    const {queue, memos, service} = setup();

    const target = {serviceId: fixtureServiceId, itemId: fixtureItems.arranged};
    const background = queue.submit(
      backgroundRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        fixtureMedia.warm,
      ),
    );
    const memo = memos.save(target, '겹친 메모');
    expect(await background).toBe(true);
    expect(await memo).toBe(true);
    expect(service().service.order[1]).toMatchObject({
      background: fixtureMedia.warm,
      memo: '겹친 메모',
    });
  });

  it('saves a memo after the edit in progress instead of dropping it', async () => {
    const {queue, memos, service} = setup();

    const choosing = queue.submit(
      arrangementRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        undefined,
      ),
    );
    const saving = memos.save(
      {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
      '기다린 메모',
    );
    expect(await choosing).toBe(true);
    expect(await saving).toBe(true);
    expect(service().service.order[1]).toMatchObject({memo: '기다린 메모'});
    expect(service().service.order[1]).not.toHaveProperty('arrangement');
  });

  it('never drops a refused memo draft by age and refuses new ones at the limit', async () => {
    const {api, memos, problem} = setup();

    vi.spyOn(api.content, 'edit').mockResolvedValue({
      ok: false,
      error: {reason: 'stale', message: 'Fixture refusal'},
    });
    const target = (n: number) => ({
      serviceId: fixtureServiceId,
      itemId: createServiceItemId(
        `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
      ),
    });
    for (let n = 0; n < 100; n++) await memos.save(target(n), `메모 ${n}`);
    expect(memos.get(target(0))).toBe('메모 0');
    expect(await memos.save(target(100), '넘침')).toBe(false);
    expect(memos.get(target(100))).toBeUndefined();
    expect(memos.get(target(0))).toBe('메모 0');
    expect(problem.mock.calls.at(-1)?.[0]).toBe(
      '저장하지 못한 메모가 너무 많음',
    );
    expect(await memos.save(target(0), '고침')).toBe(false);
    expect(memos.get(target(0))).toBe('고침');
  });
});
