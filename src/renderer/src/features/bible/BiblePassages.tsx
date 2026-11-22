import {useEffect, useLayoutEffect, useRef} from 'react';
import type {BibleSlides} from '@core/schema/biblePassage';
import {slidesOfParts} from '@core/bible/split/splitPassage';
import {verseKey, versesOfPassage} from '@core/bible/bibleTiles';
import {
  isPassageItem,
  passageOf,
  withPassage,
} from '@core/services/passageEdits';
import type {LlpApi} from '@contracts/ipc/api';
import {useShow} from '@renderer/session/showStore';
import type {Notice} from '@renderer/ui/notices';
import {installPassageSplitter, type PassageSplitter} from './passageSplitter';
import {usePassageSplitter} from './usePassageSplitter';

type Rows = ReturnType<typeof useShow.getState>['rows'];

/** The slides of each passage whose verses aren't all cut yet, by item id. */
function cutPassages(
  splitter: PassageSplitter,
  rows: Rows,
): ReadonlyMap<string, {readonly ref: string; readonly slides: BibleSlides}> {
  const cut = new Map<string, {ref: string; slides: BibleSlides}>();
  for (const row of rows) {
    if (row.kind !== 'bible' || row.bible?.passage === undefined) continue;
    const {passage, ref, slides, theme, transition} = row.bible;
    const complete = versesOfPassage(passage).every(
      ({reference}) => slides?.[verseKey(reference)] !== undefined,
    );
    if (complete) continue;
    const split = splitter.split(passage, {
      verseNumbers: row.bible.verseNumbers ?? true,
      slides,
      theme,
    });
    if (split === null) continue;
    cut.set(row.id, {
      ref,
      slides: slidesOfParts(split.parts, {slides, transition}),
    });
  }
  return cut;
}

async function keep(
  api: LlpApi,
  serviceId: string,
  cut: ReturnType<typeof cutPassages>,
): Promise<void> {
  const document = await api.services.get(serviceId);
  if (document === null || document.access === 'readOnly') return;
  const order = document.service.order.map(item => {
    const found = cut.get(item.id);
    if (found === undefined || !isPassageItem(item)) return item;
    const passage = passageOf(item);
    return passage.ref === found.ref
      ? withPassage(item, {
          ...passage,
          slides: {...found.slides, ...passage.slides},
        })
      : item;
  });
  await api.content.edit({
    type: 'service.update',
    baseRevision: document.revision,
    service: {...document.service, order},
  });
}

/** Keeps the splitter current and cuts each passage of the service once. */
export function BiblePassages({
  onProblem,
}: {
  readonly onProblem?: ((notice: Notice) => void) | undefined;
}): null {
  const splitter = usePassageSplitter(onProblem);
  const rows = useShow(view => view.rows);
  const serviceId = useShow(view => view.serviceId);
  const readOnly = useShow(view => view.readOnly);
  const saving = useRef<Promise<void> | null>(null);
  useLayoutEffect(() => installPassageSplitter(splitter), [splitter]);
  useEffect(() => {
    const api = window.llp;
    if (
      api === undefined ||
      splitter === null ||
      serviceId === null ||
      readOnly ||
      saving.current !== null
    ) {
      return;
    }
    const cut = cutPassages(splitter, rows);
    if (cut.size === 0) return;
    saving.current = keep(api, serviceId, cut)
      .catch((error: unknown) =>
        console.error('Could not cut the passages into slides', error),
      )
      .finally(() => {
        saving.current = null;
      });
  }, [splitter, rows, serviceId, readOnly]);
  return null;
}
