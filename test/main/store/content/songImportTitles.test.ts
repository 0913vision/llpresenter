import {expect, it} from 'vitest';
import {setUp} from '@fixtures/main/store/contentStoreFixtures';
import {lyricsSlide, slideOf} from '@fixtures/core/slides';

it('imports a song with its opening title apart, without its label, and without the closing copy', async () => {
  const opening = slideOf(10, 'songTitle', {
    texts: {제목: '만복의 근원 하나님'},
    label: '전주',
  });
  const closing = slideOf(11, 'songTitle', {
    texts: {제목: '만복의 근원 하나님'},
    label: '후주',
    next: '(후주)',
  });
  const verse = lyricsSlide(12, '찬양 첫 줄', {label: '1절'});
  const {store} = setUp([]);

  const result = await store.apply({
    type: 'song.import',
    draft: {title: '새 찬양', slides: [opening, verse, closing]},
    target: {kind: 'new'},
  });

  expect(result.ok).toBe(true);
  const id = result.ok ? result.value.id : '';
  const {label: _label, ...title} = opening;
  expect(store.song(id)?.song).toMatchObject({
    titleSlide: title,
    slides: [verse],
  });
});
