import {serviceItemIdSchema} from '@core/schema/ids';
import {testId} from '@core/schema/testHelpers';
import {describe, expect, it} from 'vitest';
import {EVENING_ID, HYMN_ONE_ID, SUNDAY_ID, itemId} from './testFiles';
import {
  EVENING,
  SUNDAY,
  TEMPLATE,
  serviceFile,
  setUp,
  templateFile,
} from './testing/contentStoreFixtures';

describe('ContentStore 예배 순서 and 템플릿 edits', () => {
  it('creates a 예배 순서 from a 템플릿 with new item ids, or empty', async () => {
    const {store} = setUp();

    const fromTemplate = await store.apply({
      type: 'service.create',
      name: '주일 예배',
      date: '2026-11-08T11:00',
      templateId: TEMPLATE,
    });
    const empty = await store.apply({
      type: 'service.create',
      name: '',
      date: '2026-11-11T19:30',
      templateId: null,
    });

    const id = fromTemplate.ok ? fromTemplate.value.id : '';
    const order = store.service(id)?.service.order ?? [];
    expect(
      order.map(item => ('header' in item ? item.header : 'slot')),
    ).toEqual(['찬양', '찬양']);
    expect(order.map(({id: itemIdOf}) => itemIdOf)).not.toContain(itemId(21));
    const emptyId = empty.ok ? empty.value.id : '';
    expect(store.service(emptyId)?.service.order).toEqual([]);
  });

  it('appends imported items in source order with new ids, from a 예배 순서 or a 템플릿', async () => {
    const {store} = setUp([
      serviceFile(SUNDAY_ID, [{id: itemId(1), header: '말씀'}]),
      serviceFile(EVENING_ID, [
        {id: itemId(2), header: '찬양'},
        {id: itemId(3), song: HYMN_ONE_ID},
      ]),
    ]);

    await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'service', id: EVENING},
      itemIds: [
        testId(serviceItemIdSchema, itemId(3)),
        testId(serviceItemIdSchema, itemId(2)),
      ],
    });
    await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'template', id: TEMPLATE},
      itemIds: [testId(serviceItemIdSchema, itemId(22))],
    });

    const order = store.service(SUNDAY)?.service.order ?? [];
    expect(
      order.map(item => Object.keys(item).find(key => key !== 'id')),
    ).toEqual(['header', 'header', 'song', 'header']);
    expect(new Set(order.map(({id}) => id)).size).toBe(4);
  });

  it('refuses an import of an item the source lacks', async () => {
    const {store} = setUp([serviceFile(SUNDAY_ID, [])]);

    const answer = await store.apply({
      type: 'service.importItems',
      serviceId: SUNDAY,
      from: {kind: 'template', id: TEMPLATE},
      itemIds: [testId(serviceItemIdSchema, itemId(99))],
    });

    expect(answer).toMatchObject({ok: false, error: {reason: 'invalid'}});
    expect(store.service(SUNDAY)?.service.order).toEqual([]);
  });

  it('saves a 예배 순서 as a 템플릿 with its time and new item ids', async () => {
    const {store, events} = setUp([
      serviceFile(SUNDAY_ID, [{id: itemId(1), header: '찬양'}]),
    ]);

    const answer = await store.apply({
      type: 'service.saveAsTemplate',
      serviceId: SUNDAY,
      name: '주일 오전',
    });

    const id = answer.ok ? answer.value.id : '';
    expect(store.template(id)?.template).toMatchObject({
      name: '주일 오전',
      time: '11:00',
      order: [{header: '찬양'}],
    });
    expect(store.template(id)?.template.order[0]?.id).not.toBe(itemId(1));
    expect(events.templatesListChanged).toHaveBeenCalledTimes(1);
  });

  it('updates and deletes a 예배 순서 and a 템플릿', async () => {
    const {store, files} = setUp([serviceFile(SUNDAY_ID, [])]);
    const sunday = store.service(SUNDAY);
    const template = store.template(TEMPLATE);

    expect(
      await store.apply({
        type: 'service.update',
        service: {
          ...(sunday?.service ?? serviceFile(SUNDAY_ID, []).data),
          name: '새 이름',
        },
        baseRevision: 1,
      }),
    ).toEqual({ok: true, value: {id: SUNDAY, revision: 2}});
    expect(
      await store.apply({
        type: 'template.update',
        template: {
          ...(template?.template ?? templateFile().data),
          name: '새 템플릿',
        },
        baseRevision: 1,
      }),
    ).toEqual({ok: true, value: {id: TEMPLATE, revision: 2}});
    await store.apply({type: 'service.delete', serviceId: SUNDAY});
    await store.apply({type: 'template.delete', templateId: TEMPLATE});

    expect(store.serviceList()).toEqual([]);
    expect(store.templateList()).toEqual([]);
    expect(files.removed).toHaveLength(2);
  });
});
