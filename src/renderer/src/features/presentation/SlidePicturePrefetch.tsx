import {useCallback, useEffect, useMemo, useState, type JSX} from 'react';
import {isItemRow, type SlideTile} from '@core/presentation/model';
import {slideLayerOf} from '@core/presentation/slideLayer';
import {useSlideTheme} from '@renderer/platform/useSlideTheme';
import {useShow} from '@renderer/session/show';
import {tilesForView} from '@renderer/session/showLibrary';
import type {ShowView} from '@renderer/session/showStore';
import {AheadBox, DrawAhead} from '@renderer/rendering/DrawAhead';
import {tilePicture} from './tilePicture';

/** More than the first screen of a grid at any size. */
const AHEAD_TILES = 24;
/** The open item's tiles, drawn while 진행 is hidden: a whole item. */
const OPEN_ITEM_TILES = 80;
/** Waits this long after an item opens, so its own tiles draw first. */
const START_AFTER_MS = 400;
const KINDS = new Set(['song', 'slides', 'media']);

/** The service items next to the open one, the next first, one per line. */
function neighbours(view: ShowView, openItemId: string | null): string {
  if (openItemId === null) return '';
  const items = view.rows.filter(row => isItemRow(row) && KINDS.has(row.kind));
  const at = items.findIndex(row => row.id === openItemId);
  if (at < 0) return '';
  return [items[at + 1]?.id, items[at - 1]?.id]
    .filter(id => id !== undefined)
    .join('\n');
}

function AheadItem({
  itemId,
  onDone,
  limit = AHEAD_TILES,
}: {
  readonly itemId: string;
  readonly onDone: () => void;
  readonly limit?: number;
}): JSX.Element {
  const tiles = useShow(view => tilesForView(view, itemId));
  const row = useShow(view => view.rows.find(value => value.id === itemId));
  const theme = useSlideTheme(
    row !== undefined && isItemRow(row) ? row : undefined,
  );
  const card = tiles.find(tile => tile.sectionCard !== undefined)?.sectionCard;
  const cardTheme = useSlideTheme(
    card === undefined
      ? undefined
      : {
          id: itemId,
          kind: 'slides',
          form: 'blank',
          title: card.name,
          theme: card.theme,
        },
  );
  const pictures = useMemo(
    () =>
      tiles
        .slice(0, limit)
        .map((tile: SlideTile, index) =>
          tilePicture(
            tile,
            slideLayerOf({itemId, index}, () => tiles),
            {
              theme,
              cardTheme,
              sermonTheme: undefined,
              bibleAppearance: undefined,
            },
          ),
        )
        .filter(picture => picture !== undefined),
    [tiles, itemId, theme, cardTheme, limit],
  );
  return <DrawAhead pictures={pictures} onDone={onDone} />;
}

/**
 * Draws the first tiles of the items next to the open one while 진행 is idle.
 * Their finished pictures wait in the picture park, so opening the next item
 * shows its tiles in the next frame instead of the previous item for a moment.
 */
export function SlidePicturePrefetch({
  openItemId,
}: {
  readonly openItemId: string | null;
}): JSX.Element | null {
  const targets = useShow(view => neighbours(view, openItemId));
  const [step, setStep] = useState({targets: '', index: -1});
  useEffect(() => {
    const timer = setTimeout(
      () => setStep({targets, index: 0}),
      START_AFTER_MS,
    );
    return () => clearTimeout(timer);
  }, [targets]);
  const list =
    step.targets === targets && targets !== '' ? targets.split('\n') : [];
  const itemId = step.index >= 0 ? list[step.index] : undefined;
  const next = useCallback(
    () =>
      setStep(current =>
        current.targets === targets
          ? {targets, index: current.index + 1}
          : current,
      ),
    [targets],
  );
  if (itemId === undefined) return null;
  return (
    <AheadBox>
      <AheadItem key={itemId} itemId={itemId} onDone={next} />
    </AheadBox>
  );
}

const identities = new WeakMap<object, number>();
let nextIdentity = 1;

function identityOf(value: object | null | undefined): number {
  if (value === null || value === undefined) return 0;
  let found = identities.get(value);
  if (found === undefined) {
    found = nextIdentity++;
    identities.set(value, found);
  }
  return found;
}

/**
 * While 진행 stays hidden behind 준비 or 테마, draws the open item's first
 * tiles again whenever what they show changes, a moment after the last change.
 * 진행 then shows the changed tiles in its first frame, neither empty nor with
 * their old pictures.
 */
export function OpenItemPrefetch(): JSX.Element | null {
  const itemId = useShow(view => view.openItemId);
  const tiles = useShow(view =>
    itemId === null ? null : tilesForView(view, itemId),
  );
  const row = useShow(view => view.rows.find(value => value.id === itemId));
  const theme = useSlideTheme(
    row !== undefined && isItemRow(row) ? row : undefined,
  );
  const key =
    itemId === null
      ? ''
      : `${itemId}:${identityOf(tiles)}:${identityOf(row)}:${identityOf(theme)}`;
  const [due, setDue] = useState('');
  const [drawn, setDrawn] = useState('');
  useEffect(() => {
    if (key === '') return undefined;
    const timer = setTimeout(() => setDue(key), START_AFTER_MS);
    return () => clearTimeout(timer);
  }, [key]);
  const done = useCallback(() => setDrawn(due), [due]);
  if (itemId === null || due !== key || drawn === key) return null;
  return (
    <AheadBox>
      <AheadItem
        key={key}
        itemId={itemId}
        onDone={done}
        limit={OPEN_ITEM_TILES}
      />
    </AheadBox>
  );
}
