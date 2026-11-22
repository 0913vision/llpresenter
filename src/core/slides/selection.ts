export type SlideListPoint<Id extends string> =
  | {readonly kind: 'slide'; readonly id: Id}
  | {readonly kind: 'gap'; readonly index: number};

export interface SlideListSelection<Id extends string> {
  readonly ids: ReadonlySet<Id>;
  readonly anchor: SlideListPoint<Id> | null;
  readonly focus: SlideListPoint<Id> | null;
  readonly caret: number | null;
}

export type SlideSelectionAction<Id extends string> =
  | {
      readonly type: 'click';
      readonly id: Id;
      readonly shift?: boolean;
      readonly ctrl?: boolean;
    }
  | {readonly type: 'gap'; readonly index: number}
  | {readonly type: 'arrow'; readonly delta: number; readonly shift?: boolean}
  | {readonly type: 'all'}
  | {readonly type: 'clear'};

export function emptySlideSelection<
  Id extends string,
>(): SlideListSelection<Id> {
  return {ids: new Set(), anchor: null, focus: null, caret: null};
}

function gapSelection<Id extends string>(
  index: number,
): SlideListSelection<Id> {
  const point = {kind: 'gap', index} as const;
  return {ids: new Set(), anchor: point, focus: point, caret: index};
}

function slideSelection<Id extends string>(id: Id): SlideListSelection<Id> {
  const point = {kind: 'slide', id} as const;
  return {ids: new Set([id]), anchor: point, focus: point, caret: null};
}

function clamp(index: number, end: number): number {
  return Math.max(0, Math.min(index, end));
}

function range<Id extends string>(
  ids: readonly Id[],
  from: number,
  to: number,
): ReadonlySet<Id> {
  return new Set(ids.slice(Math.min(from, to), Math.max(from, to)));
}

function extend<Id extends string>(
  ids: readonly Id[],
  state: SlideListSelection<Id>,
  target: SlideListPoint<Id>,
): SlideListSelection<Id> {
  const anchor = state.anchor ?? state.focus ?? target;
  if (anchor.kind === 'gap') {
    const index = target.kind === 'gap' ? target.index : ids.indexOf(target.id);
    const edge =
      target.kind === 'slide' && index >= anchor.index ? index + 1 : index;
    const selected = range(ids, anchor.index, edge);
    return {
      ids: selected,
      anchor,
      focus: {kind: 'gap', index: edge},
      caret: selected.size === 0 ? edge : null,
    };
  }
  const start = ids.indexOf(anchor.id);
  const end =
    target.kind === 'slide'
      ? ids.indexOf(target.id)
      : clamp(target.index, ids.length - 1);
  return {
    ids: range(ids, Math.min(start, end), Math.max(start, end) + 1),
    anchor,
    focus: target,
    caret: null,
  };
}

function click<Id extends string>(
  ids: readonly Id[],
  state: SlideListSelection<Id>,
  action: Extract<SlideSelectionAction<Id>, {type: 'click'}>,
): SlideListSelection<Id> {
  if (!ids.includes(action.id)) return state;
  const single = slideSelection(action.id);
  if (action.shift) {
    const next = extend(ids, state, {kind: 'slide', id: action.id});
    return action.ctrl
      ? {...next, ids: new Set([...state.ids, ...next.ids])}
      : next;
  }
  if (!action.ctrl) return single;
  const selected = new Set(state.ids);
  if (selected.has(action.id)) selected.delete(action.id);
  else selected.add(action.id);
  return {...single, ids: selected};
}

function arrow<Id extends string>(
  ids: readonly Id[],
  state: SlideListSelection<Id>,
  action: Extract<SlideSelectionAction<Id>, {type: 'arrow'}>,
): SlideListSelection<Id> {
  const {delta} = action;
  if (!Number.isInteger(delta) || delta === 0) return state;
  if (ids.length === 0) return gapSelection(0);
  const focus = state.focus;
  if (action.shift && state.anchor?.kind === 'gap') {
    const edge = focus?.kind === 'gap' ? focus.index : state.anchor.index;
    return extend(ids, state, {
      kind: 'gap',
      index: clamp(edge + delta, ids.length),
    });
  }
  if (state.ids.size === 0 && !action.shift) {
    const start =
      state.caret ?? (focus?.kind === 'slide' ? ids.indexOf(focus.id) : 0);
    return gapSelection(clamp(start + delta, ids.length));
  }
  if (state.ids.size === 0 && focus === null) {
    return arrow(ids, gapSelection(0), action);
  }
  const start =
    focus?.kind === 'slide'
      ? ids.indexOf(focus.id)
      : (focus?.index ?? 0) -
        (state.anchor?.kind === 'gap' &&
        focus?.kind === 'gap' &&
        focus.index > state.anchor.index
          ? 1
          : 0);
  const id = ids[clamp(start + delta, ids.length - 1)];
  if (id === undefined) return state;
  return action.shift
    ? extend(ids, state, {kind: 'slide', id})
    : slideSelection(id);
}

/** Gap indices are between slides, from zero through the deck length. */
export function selectSlideList<Id extends string>(
  ids: readonly Id[],
  state: SlideListSelection<Id>,
  action: SlideSelectionAction<Id>,
): SlideListSelection<Id> {
  switch (action.type) {
    case 'clear':
      return emptySlideSelection();
    case 'click':
      return click(ids, state, action);
    case 'arrow':
      return arrow(ids, state, action);
    case 'gap':
      return Number.isInteger(action.index) &&
        action.index >= 0 &&
        action.index <= ids.length
        ? gapSelection(action.index)
        : state;
    case 'all': {
      const first = ids[0];
      const last = ids.at(-1);
      return first === undefined || last === undefined
        ? gapSelection(0)
        : {
            ids: new Set(ids),
            anchor: {kind: 'slide', id: first},
            focus: {kind: 'slide', id: last},
            caret: null,
          };
    }
  }
}

/** With neither selection nor caret, paste appends to the deck. */
export function slideInsertionIndex<Id extends string>(
  ids: readonly Id[],
  state: SlideListSelection<Id>,
): number {
  if (state.caret !== null) return state.caret;
  const last = ids.findLastIndex(id => state.ids.has(id));
  return last < 0 ? ids.length : last + 1;
}
