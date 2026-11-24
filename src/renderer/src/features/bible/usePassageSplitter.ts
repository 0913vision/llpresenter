import {useEffect, useMemo, useState} from 'react';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import {useThemes} from '@renderer/platform/documents/themes';
import {createFontMeasure} from '@renderer/rendering/theme/splitMeasure';
import type {Notice} from '@renderer/ui/popups/notices';
import {PassageSplitter} from './passageSplitter';

/** A splitter that follows the themes, fonts and remembered cuts. */
export function usePassageSplitter(
  onProblem?: (notice: Notice) => void,
): PassageSplitter | null {
  const themes = useThemes(view => view.themes);
  const saved = useSettingsDocument('bibleCuts', '절 나누기', onProblem);
  const [measurement, setMeasurement] = useState(() => ({
    canvas: createFontMeasure(),
  }));
  useEffect(() => {
    const update = (): void => setMeasurement(value => ({...value}));
    document.fonts.addEventListener('loadingdone', update);
    return () => document.fonts.removeEventListener('loadingdone', update);
  }, []);
  return useMemo(
    () =>
      measurement.canvas === null || themes === null || saved === null
        ? null
        : new PassageSplitter({
            themes,
            saved: saved.value,
            canvas: measurement.canvas,
          }),
    [measurement, themes, saved],
  );
}
