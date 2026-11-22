import {useEffect, useMemo, useState} from 'react';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {createBibleMeasureContext} from '@renderer/rendering/bibleMeasure';
import type {Notice} from '@renderer/ui/notices';
import {PassageSplitter} from './passageSplitter';

/** A splitter that follows the themes, screens, fonts and remembered cuts. */
export function usePassageSplitter(
  onProblem?: (notice: Notice) => void,
): PassageSplitter | null {
  const themes = useSettingsDocument('themes', '테마', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const saved = useSettingsDocument('bibleCuts', '절 나누기', onProblem);
  const [measurement, setMeasurement] = useState(() => ({
    canvas: createBibleMeasureContext(),
  }));
  useEffect(() => {
    const fonts = document.fonts;
    if (typeof fonts === 'undefined') return;
    const update = (): void => setMeasurement(value => ({...value}));
    fonts.addEventListener('loadingdone', update);
    return () => fonts.removeEventListener('loadingdone', update);
  }, []);
  return useMemo(
    () =>
      measurement.canvas === null ||
      themes === null ||
      screens === null ||
      saved === null
        ? null
        : new PassageSplitter({
            themes: themes.value,
            screens: screens.value.screens,
            saved: saved.value,
            canvas: measurement.canvas,
          }),
    [measurement, themes, screens, saved],
  );
}
