import {useEffect, useMemo, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {BibleLookupPassage} from '@core/schema/bibleLookup';
import type {VerseSlide} from '@core/schema/service';
import type {SlidesItem} from '@core/services/slidesEdits';
import {colorSlideLabels, projectSlides} from '@core/presentation/slides';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import {useApiSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {BibleProjections} from './splitProjection';
import {loadVersePassages} from './loadSlidesProjection';
import {useBibleDisplayDefaults} from './useBibleDisplayDefaults';

/** Resolves only the verse slots of a local draft, dropping stale lookup replies. */
export function useSlidesVerseProjection(
  api: Pick<LlpApi, 'bible' | 'settings'>,
  item: SlidesItem,
  enabled = true,
) {
  const references = item.slides.slides
    .filter((slide): slide is VerseSlide => 'verse' in slide)
    .map(({id, verse}) => ({id, verse}));
  const key = JSON.stringify(references);
  const [request, setRequest] = useState({key, references});
  if (request.key !== key) setRequest({key, references});
  const active = enabled && references.length > 0;
  const slideBibleDefaults = useBibleDisplayDefaults(
    active ? window.llp?.preferences : undefined,
  );
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
  const labels = useApiSettingsDocument({
    api,
    name:
      active && item.slides.slides.some(slide => slide.label !== undefined)
        ? 'labels'
        : null,
    title: '이름표',
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
    if (themeFile?.name !== 'themes' || screenFile?.name !== 'screens') {
      return null;
    }
    return new BibleProjections({
      themes: themeFile.value,
      screens: screenFile.value.screens,
      saved: undefined,
      canvas: measurement.canvas,
      slideBibleDefaults,
    }).get({
      kind: 'slides',
      id: item.id,
      input: colorSlideLabels(
        projectSlides(item, undefined, {
          passages: loaded.passages,
          adTitleSettings: {
            file: themeFile.value,
            screens: screenFile.value.screens,
          },
        }),
        new Map(
          (labels?.name === 'labels' ? labels.value.labels : []).map(label => [
            label.name,
            label.color,
          ]),
        ),
      ),
      verseNumbers: true,
      reference: 'every',
      translationName: false,
      source: 'service',
      review: false,
      ...(item.textOverrides === undefined
        ? {}
        : {textOverrides: item.textOverrides}),
      ...(item.background === undefined ? {} : {background: item.background}),
      ...(item.theme === undefined ? {} : {theme: item.theme}),
    });
  }, [
    active,
    loaded,
    request,
    measurement,
    themes,
    screens,
    labels,
    item,
    slideBibleDefaults,
  ]);
  return {
    projection,
    failed:
      (loaded?.request === request && loaded.failed) ||
      (active && measurement.canvas === null),
  };
}
