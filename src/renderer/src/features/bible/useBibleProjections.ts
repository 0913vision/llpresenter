import {useEffect, useMemo, useState, useSyncExternalStore} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {useShow} from '@renderer/session/show';
import type {Notice} from '@renderer/ui/notices';
import {BibleProjections, splitSourceFor} from './splitProjection';
import {bibleRefinements} from './BibleRefinements';

/** Shares the output measurement rules and follows settings, fonts and unsaved cuts. */
export function useBibleProjections({
  enabled = true,
  onProblem,
}: {
  readonly enabled?: boolean;
  readonly onProblem?: ((notice: Notice) => void) | undefined;
} = {}) {
  const refinementRevision = useSyncExternalStore(
    bibleRefinements.subscribe,
    bibleRefinements.getSnapshot,
  );
  const themes = useSettingsDocument(
    enabled ? 'themes' : null,
    '테마',
    onProblem,
  );
  const screens = useSettingsDocument(
    enabled ? 'screens' : null,
    '화면',
    onProblem,
  );
  const saved = useSettingsDocument(
    enabled ? 'bibleCuts' : null,
    '절 나누기',
    onProblem,
  );
  const [measurement, setMeasurement] = useState(() => ({
    enabled,
    canvas: enabled ? createBibleMeasureContext() : null,
  }));
  if (measurement.enabled !== enabled) {
    setMeasurement({
      enabled,
      canvas: enabled ? createBibleMeasureContext() : null,
    });
  }
  useEffect(() => {
    if (!enabled) return;
    const update = (): void => setMeasurement(value => ({...value}));
    const fonts = document.fonts;
    if (typeof fonts === 'undefined') return;
    fonts.addEventListener('loadingdone', update);
    return () => fonts.removeEventListener('loadingdone', update);
  }, [enabled]);
  const projections = useMemo(
    () =>
      measurement.canvas === null ||
      themes === null ||
      screens === null ||
      saved === null
        ? null
        : new BibleProjections({
            themes: themes.value,
            screens: screens.value.screens,
            saved: saved.value,
            canvas: measurement.canvas,
          }),
    [themes, screens, saved, measurement],
  );
  return {projections, themes, screens, saved, refinementRevision};
}

/** Reads a measured item for thumbnails without starting a refinement or review. */
export function useBibleTileProjection({
  itemId,
  serviceId,
}: {
  readonly itemId: string | null;
  readonly serviceId?: string;
}) {
  const enabled = useShow(
    view =>
      itemId !== null &&
      view.openItemId === itemId &&
      (serviceId === undefined || serviceId === view.serviceId) &&
      splitSourceFor(view, itemId) !== null,
  );
  const {projections, refinementRevision} = useBibleProjections({enabled});
  return useShow(view => {
    if (
      !enabled ||
      itemId === null ||
      view.openItemId !== itemId ||
      (serviceId !== undefined && view.serviceId !== serviceId) ||
      projections === null
    ) {
      return null;
    }
    const source = splitSourceFor(view, itemId);
    return source === null ? null : projections.get(source, refinementRevision);
  });
}
