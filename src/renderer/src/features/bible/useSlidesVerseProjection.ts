import {useEffect, useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {projectSlides} from '@core/presentation/slides';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {BibleProjections} from './splitProjection';
import {loadVersePassages} from './loadSlidesProjection';

/** Resolves only the verse slots of a local draft, dropping stale lookup replies. */
export function useSlidesVerseProjection(
  api: Pick<LlpApi, 'bible' | 'settings'>,
  item: SlidesItem,
  enabled = true,
) {
  const references = item.slides.slides.filter(
    (slide): slide is VerseSlide => 'verse' in slide,
  );
  const key = JSON.stringify(references);
  const [request, setRequest] = useState({key, references});
  if (request.key !== key) setRequest({key, references});
  const active = enabled && references.length > 0;
  const themes = useApiSettingsDocument({
    api,
    name: active ? 'themes' : null,
    title: '테마',
  });
  const screens = useApiSettingsDocument({
    api,
    name: active ? 'screens' : null,
    title: '화면',
  });
  const cuts = useApiSettingsDocument({
    api,
    name: active ? 'bibleCuts' : null,
    title: '절 나누기',
  });
  const [measurement, setMeasurement] = useState(() => ({
    active,
    canvas: active ? createBibleMeasureContext() : null,
  }));
  if (measurement.active !== active) {
    setMeasurement({
      active,
      canvas: active ? createBibleMeasureContext() : null,
    });
  }
  const [loaded, setLoaded] = useState<{
    request: typeof request;
    passages: ReadonlyMap<string, BibleLookupPassage>;
    failed: boolean;
  } | null>(null);
  useEffect(() => {
    if (!active) return undefined;
    const update = (): void => setMeasurement(value => ({...value}));
    const fonts = document.fonts;
    if (typeof fonts === 'undefined') return undefined;
    fonts.addEventListener('loadingdone', update);
    return () => fonts.removeEventListener('loadingdone', update);
  }, [active]);
  useEffect(() => {
    if (!active) return undefined;
    let current = true;
    const read = async (): Promise<void> => {
      const passages = await loadVersePassages(
        api.bible,
        request.references,
        () => current,
      );
      if (current) {
        setLoaded({
          request,
          passages,
          failed: passages.size < request.references.length,
        });
      }
    };
    read().catch(() => {
      if (current) setLoaded({request, passages: new Map(), failed: true});
    });
    return () => {
      current = false;
    };
  }, [api.bible, request, active]);
  const projection = useMemo(() => {
    if (!active || loaded?.request !== request || measurement.canvas === null) {
      return null;
    }
    const themeFile = themes;
    const screenFile = screens;
    const cutFile = cuts;
    if (
      themeFile?.name !== 'themes' ||
      screenFile?.name !== 'screens' ||
      cutFile?.name !== 'bibleCuts'
    ) {
      return null;
    }
    return new BibleProjections({
      themes: themeFile.value,
      screens: screenFile.value.screens,
      saved: cutFile.value,
      canvas: measurement.canvas,
    }).get({
      kind: 'slides',
      id: item.id,
      input: projectSlides(item, undefined, loaded.passages),
      verseNumbers: true,
      reference: 'every',
      translationName: false,
      source: 'service',
      ...(item.theme === undefined ? {} : {theme: item.theme}),
    });
  }, [active, loaded, request, measurement, themes, screens, cuts, item]);
  return {
    projection,
    failed:
      (loaded?.request === request && loaded.failed) ||
      (active && measurement.canvas === null),
  };
}
