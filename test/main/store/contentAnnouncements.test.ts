import {describe, expect, it} from 'vitest';
import {setUp, songEdit} from '@fixtures/main/store/contentStoreFixtures';

describe('ContentStore announcements', () => {
  it('pushes only the list whose displayed fields changed', async () => {
    const {store, events} = setUp();

    await store.apply(songEdit(store, '바뀐 제목', 1));

    expect(events.songsListChanged).toHaveBeenCalledTimes(1);
    expect(events.servicesListChanged).not.toHaveBeenCalled();
    expect(events.templatesListChanged).not.toHaveBeenCalled();
  });
});
