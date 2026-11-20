import {useEffect} from 'react';
import {isItemRow} from '@core/presentation/model';
import {pictureSpec} from '@renderer/rendering/pictureSpec';
import {useShow} from '@renderer/session/show';
import {tilesForView} from '@renderer/session/showLibrary';
import {pictures} from '@renderer/rendering/pictures/pictureService';
import {useBibleProjections} from '../bible/useBibleProjections';
import {splitSourceFor} from '../bible/splitProjection';
import {serviceTileThemes} from './tilePicture';

/** Preloads the service in the background, starting at the open item. */
export function OpenItemPrefetch(): null {
  const rows = useShow(view => view.rows);
  const allTiles = useShow(view => view.tiles);
  const openItemId = useShow(view => view.openItemId);
  const {themes, screens, projections} = useBibleProjections({
    enabled: rows.length > 0,
  });
  useEffect(() => {
    if (themes === null || screens === null) return undefined;
    const items = rows
      .filter(isItemRow)
      .sort(
        (a, b) => Number(b.id === openItemId) - Number(a.id === openItemId),
      );
    const view = useShow.getState();
    let idle = 0;
    let itemIndex = 0;
    const next = (): void => {
      const row = items[itemIndex++];
      if (row === undefined) return;
      const source = splitSourceFor(view, row.id);
      const bible = source === null ? null : projections?.get(source);
      const tiles = tilesForView(view, row.id);
      const tileThemes = serviceTileThemes(row, tiles, {
        themes: themes.value,
        screens: screens.value.screens,
        bibleAppearance: bible?.appearance,
      });
      const specs = tiles.flatMap((_, index) => {
        const result = pictureSpec({
          kind: 'sequence',
          itemId: row.id,
          index,
          tiles,
          themes: tileThemes,
        });
        return result === undefined ? [] : [result.spec];
      });
      pictures.prepare(specs);
      idle = requestIdleCallback(next, {timeout: 1000});
    };
    if (items.length > 0) idle = requestIdleCallback(next, {timeout: 1000});
    return () => cancelIdleCallback(idle);
  }, [allTiles, openItemId, projections, rows, screens, themes]);
  return null;
}
