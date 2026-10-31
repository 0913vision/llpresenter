import {describe, expect, it, vi} from 'vitest';
import {fixtureItems, fixtureMacros, fixtureServiceId} from './itemFixture';
import {itemEditFixture} from './itemEditTesting';
import {arrangementRequest, startMacroRequest} from './itemPlaybackCommands';
describe('item edit queue', () => {
  it('refuses a 구성 for other kinds and reports main refusals', async () => {
    const {api, queue, problem, edits} = itemEditFixture();
    let target = {serviceId: fixtureServiceId, itemId: fixtureItems.slot};

    expect(await queue.submit(arrangementRequest(target, '주일용'))).toBe(
      false,
    );
    expect(edits).toEqual([]);
    expect(problem.mock.calls.at(-1)?.[0]).toBe('구성 변경 실패');
    target = {serviceId: fixtureServiceId, itemId: fixtureItems.plain};
    vi.spyOn(api.content, 'edit').mockResolvedValueOnce({
      ok: false,
      error: {
        reason: 'write-failed',
        message: 'Disk full',
        applied: {id: fixtureServiceId, revision: 4},
        unchangedFiles: ['invented.llservice'],
      },
    });
    expect(await queue.submit(arrangementRequest(target, '주일용'))).toBe(true);
    expect(problem.mock.calls.at(-1)?.[0]).toBe('예배 순서 저장 실패');
  });

  it('runs item edits one after another without refusing the later ones', async () => {
    const {queue, edits, service} = itemEditFixture();

    const first = queue.submit(
      arrangementRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        undefined,
      ),
    );
    const second = queue.submit(
      startMacroRequest(
        {serviceId: fixtureServiceId, itemId: fixtureItems.arranged},
        fixtureMacros.praise,
      ),
    );
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(queue.busy).toBe(false);
    expect(edits.filter(edit => edit.type === 'service.update')).toHaveLength(
      2,
    );
    expect(service().service.order[1]).toMatchObject({
      macro: fixtureMacros.praise,
    });
    expect(service().service.order[1]).not.toHaveProperty('arrangement');
  });
});
