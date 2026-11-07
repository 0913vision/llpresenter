import type {SongSlide} from '@core/schema/song';
import {songSlideListAdapter} from '@core/songs/songSlideListAdapter';
import {createSlideListHistory} from '@core/songs/slideListHistory';
import {selectSlideList} from '@core/songs/slideListSelection';
import type {Result} from '@core/common/result';
import {fixtureSlideId} from './slideFixtures';

export function slideListItem(index: number): SongSlide {
  return {id: fixtureSlideId(index), lines: [`Line ${index}`], label: 'Verse'};
}
export function slideListAdapter() {
  let next = 100;
  return songSlideListAdapter({newId: () => fixtureSlideId(next++)});
}
export function resultValue<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
}
export function selectedSlideList(numbers = [1, 2, 3, 4], selected = [2, 4]) {
  const adapter = slideListAdapter();
  const history = resultValue(
    createSlideListHistory(numbers.map(slideListItem), adapter),
  );
  const ids = history.present.slides.map(slide => slide.id);
  let selection = history.present.selection;
  for (const number of selected) {
    selection = selectSlideList(ids, selection, {
      type: 'click',
      id: fixtureSlideId(number),
      ctrl: true,
    });
  }
  return {
    adapter,
    history: {...history, present: {...history.present, selection}},
  };
}
