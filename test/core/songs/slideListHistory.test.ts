import {describe, expect, it} from 'vitest';
import {
  applySlideListCommand,
  createSlideListHistory,
  redoSlideList,
  undoSlideList,
  SLIDE_LIST_HISTORY_LIMIT,
  recordSlideListSnapshot,
} from '@core/songs/slideListHistory';
import {
  resultValue,
  selectedSlideList,
  slideListItem,
} from '@fixtures/core/songs/slideList';
import {selectSlideList} from '@core/songs/slideListSelection';

describe('slide list history', () => {
  it('records validated text and its caret in structural history, coalescing only after the first step', () => {
    const {history, adapter} = selectedSlideList();
    const first = history.present.slides[0];
    if (!first) throw new Error('Missing slide');
    const textSelection = {id: first.id, start: 1, end: 1};
    const typed = {
      ...history.present,
      textSelection,
      slides: history.present.slides.map(slide =>
        slide.id === first.id ? {...slide, lines: ['A']} : slide,
      ),
    };
    const once = resultValue(
      recordSlideListSnapshot(history, typed, {adapter, coalesce: true}),
    );
    expect(once.past).toHaveLength(1);
    const twice = resultValue(
      recordSlideListSnapshot(
        once,
        {
          ...typed,
          textSelection: {...textSelection, start: 2, end: 2},
          slides: typed.slides.map(slide =>
            slide.id === first.id ? {...slide, lines: ['AB']} : slide,
          ),
        },
        {adapter, coalesce: true},
      ),
    );
    expect(twice.past).toHaveLength(1);
    expect(undoSlideList(twice).present).toEqual(history.present);
    expect(redoSlideList(undoSlideList(twice)).present).toEqual(twice.present);
    expect(
      recordSlideListSnapshot(
        twice,
        {...typed, slides: [first, first]},
        {adapter},
      ),
    ).toEqual({ok: false, error: 'invalid'});
    expect(twice.present.slides[0]?.lines).toEqual(['AB']);
  });
  it.each([
    {type: 'duplicate'},
    {type: 'delete'},
    {type: 'move', index: 0},
    {type: 'label', label: 'Today'},
    {type: 'paste', slides: [slideListItem(9)]},
  ] as const)(
    'undoes and redoes $type as one step, including selection and stable copy identities',
    command => {
      const {adapter, history} = selectedSlideList();
      const changed = resultValue(
        applySlideListCommand(history, command, adapter),
      );
      expect(changed.past).toHaveLength(1);
      const undone = undoSlideList(changed);
      expect(undone.present).toEqual(history.present);
      expect(undone.past).toHaveLength(0);
      expect(redoSlideList(undone).present).toEqual(changed.present);
      expect(undoSlideList(history)).toBe(history);
      expect(redoSlideList(changed)).toBe(changed);
    },
  );

  it('restores a paste caret with undo and retains redo after selection changes and no-ops', () => {
    const {adapter, history} = selectedSlideList();
    const selection = selectSlideList(
      history.present.slides.map(slide => slide.id),
      history.present.selection,
      {type: 'gap', index: 0},
    );
    const before = {...history, present: {...history.present, selection}};
    const pasted = resultValue(
      applySlideListCommand(
        before,
        {type: 'paste', slides: [slideListItem(9)]},
        adapter,
      ),
    );
    const undone = undoSlideList(pasted);
    expect(undone.present.selection.caret).toBe(0);
    expect(
      resultValue(applySlideListCommand(undone, {type: 'delete'}, adapter)),
    ).toBe(undone);
    expect(redoSlideList(undone).present.slides).toEqual(pasted.present.slides);
  });

  it('clears redo for a new edit and retains both stacks when validation refuses an edit', () => {
    const {adapter, history} = selectedSlideList();
    const changed = resultValue(
      applySlideListCommand(history, {type: 'label', label: 'One'}, adapter),
    );
    const undone = undoSlideList(changed);
    expect(
      applySlideListCommand(
        undone,
        {type: 'label', label: 'x'.repeat(65)},
        adapter,
      ).ok,
    ).toBe(false);
    expect(undone.future).toHaveLength(1);
    expect(
      resultValue(
        applySlideListCommand(undone, {type: 'label', label: 'Two'}, adapter),
      ).future,
    ).toEqual([]);
  });

  it('retains only the last 100 edit steps', () => {
    const setup = selectedSlideList([1], [1]);
    let history = setup.history;
    for (let index = 0; index < SLIDE_LIST_HISTORY_LIMIT + 5; index++) {
      history = resultValue(
        applySlideListCommand(
          history,
          {type: 'label', label: String(index)},
          setup.adapter,
        ),
      );
    }
    expect(history.past).toHaveLength(100);
    for (let index = 0; index < 100; index++) history = undoSlideList(history);
    expect(history.present.slides[0]?.label).toBe('4');
    expect(undoSlideList(history)).toBe(history);
    for (let index = 0; index < 100; index++) history = redoSlideList(history);
    expect(history.present.slides[0]?.label).toBe('104');
  });

  it('loads an isolated document snapshot and rejects an invalid initial list', () => {
    const {adapter} = selectedSlideList();
    const source = [slideListItem(1)];
    const history = resultValue(createSlideListHistory(source, adapter));
    expect(history.present.slides).not.toBe(source);
    expect(history.present.slides[0]?.lines).not.toBe(source[0]?.lines);
    expect(
      createSlideListHistory([slideListItem(1), slideListItem(1)], adapter).ok,
    ).toBe(false);
  });
});
