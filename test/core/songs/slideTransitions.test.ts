import {expect, it} from 'vitest';
import {
  applySlideListCommand,
  undoSlideList,
  redoSlideList,
} from '@core/songs/slideListHistory';
import {resultValue, selectedSlideList} from '@fixtures/core/songs/slideList';

it('applies an effect atomically to a disjoint selection and undoes/redoes each command once', () => {
  const {adapter, history} = selectedSlideList();
  const transition = {kind: 'wipe', dir: 'up', sec: 4} as const;
  const changed = resultValue(
    applySlideListCommand(history, {type: 'transition', transition}, adapter),
  );
  expect(changed.present.slides.map(slide => slide.transition)).toEqual([
    undefined,
    transition,
    undefined,
    transition,
  ]);
  expect(changed.present.selection).toEqual(history.present.selection);
  expect(undoSlideList(changed).present).toBe(history.present);
  expect(redoSlideList(undoSlideList(changed)).present).toBe(changed.present);
  const all = resultValue(
    applySlideListCommand(
      changed,
      {type: 'transition', transition, all: true},
      adapter,
    ),
  );
  expect(all.present.slides.every(slide => slide.transition?.sec === 4)).toBe(
    true,
  );
  expect(undoSlideList(all).present).toBe(changed.present);
  expect(
    resultValue(
      applySlideListCommand(
        all,
        {type: 'transition', transition, all: true},
        adapter,
      ),
    ),
  ).toBe(all);
  const cleared = resultValue(
    applySlideListCommand(
      all,
      {type: 'transition', transition: undefined, all: true},
      adapter,
    ),
  );
  expect(cleared.present.slides.every(slide => !('transition' in slide))).toBe(
    true,
  );
  expect(cleared.present.slides).toEqual(history.present.slides);
  expect(undoSlideList(cleared).present).toBe(all.present);
});

it('rejects an invalid transition without changing any selected slide or its history', () => {
  const {adapter, history} = selectedSlideList();
  expect(
    applySlideListCommand(
      history,
      {type: 'transition', transition: {kind: 'wipe', sec: 10.1}},
      adapter,
    ).ok,
  ).toBe(false);
  expect(
    history.present.slides.every(slide => slide.transition === undefined),
  ).toBe(true);
  expect(history.past).toHaveLength(0);
});
