import {serviceItemIdSchema} from '@core/schema/ids';
import {testId} from '@core/schema/testHelpers';
import {describe, expect, it} from 'vitest';
import {SUNDAY_ID, itemId} from './testFiles';
import {
  SONG,
  SUNDAY,
  serviceFile,
  setUp,
  songEdit,
} from './testing/contentStoreFixtures';

describe('ContentStore announcements', () => {
  it('pushes only the list whose displayed fields changed', async () => {
    const {store, events} = setUp();

    await store.apply(songEdit(store, '바뀐 제목', 1));

    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.servicesListChanged).not.toHaveBeenCalled();
    expect(events.templatesListChanged).not.toHaveBeenCalled();
  });

  it('refreshes library usage after an item is added or its service is renamed', async () => {
    const {store, events} = setUp([serviceFile(SUNDAY_ID, [])]);
    const sunday = store.service(SUNDAY);
    if (sunday === null) throw new Error('Missing test service');
    await store.apply({
      type: 'service.update',
      baseRevision: 1,
      service: {
        ...sunday.service,
        name: '수정 예배',
        order: [{id: testId(serviceItemIdSchema, itemId(1)), song: SONG}],
      },
    });

    expect(store.songList()[0]?.usedBy).toEqual([
      {id: SUNDAY, name: '수정 예배'},
    ]);
    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.servicesListChanged).toHaveBeenCalledTimes(1);
    expect(events.templatesListChanged).not.toHaveBeenCalled();
  });
});
