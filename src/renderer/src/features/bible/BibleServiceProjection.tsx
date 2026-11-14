import {useEffect, useRef} from 'react';
import {useShow} from '@renderer/session/show';
import {useBibleProjections} from './useBibleProjections';
import {splitSourceFor} from './splitProjection';
import {parseBibleProjection} from '@core/schema/bibleProjection';

/** Publish the same measured tiles for every saved Bible item in the open service. */
export function BibleServiceProjection(): null {
  const view = useShow();
  const {projections, themes, screens, saved, refinementRevision} =
    useBibleProjections();
  const published = useRef(new Map<string, string>());
  const publishedService = useRef<string | null>(null);
  useEffect(() => {
    if (publishedService.current !== view.serviceId) {
      published.current.clear();
      publishedService.current = view.serviceId;
    }
    const api = window.llp;
    if (
      !api ||
      !view.serviceId ||
      !projections ||
      !themes ||
      !screens ||
      !saved
    ) {
      return;
    }
    for (const row of view.rows) {
      if (row.kind !== 'bible' || row.sourceRevision === undefined) continue;
      const source = splitSourceFor(view, row.id);
      if (source?.kind !== 'bible' || source.source !== 'service') {
        continue;
      }
      const projection = projections.get(source, refinementRevision);
      if (
        !projection ||
        projection.problem ||
        projection.parts.some(part => part.problem)
      ) {
        continue;
      }
      const payload = {
        serviceId: view.serviceId,
        itemId: row.id,
        revision: row.sourceRevision,
        measurement: {
          themes: themes.revision,
          screens: screens.revision,
          bibleCuts: saved.revision,
        },
        tiles: projection.tiles,
      };
      const signature = JSON.stringify(payload);
      if (published.current.get(row.id) === signature) continue;
      const parsed = parseBibleProjection(payload);
      if (!parsed.ok) continue;
      api.service.bibleProjection(parsed.value);
      published.current.set(row.id, signature);
    }
  }, [view, projections, themes, screens, saved, refinementRevision]);
  return null;
}
