import {useScreenList} from '@renderer/platform/screens/useScreenList';
import {useState} from 'react';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import type {Notice} from '@renderer/ui/popups/notices';

/** The themes and screens the editor works on, once they have loaded. */
export function useThemeResources(
  active: boolean,
  onProblem: ((notice: Notice) => void) | undefined,
) {
  const [load, setLoad] = useState({
    active,
    themesFailed: false,
    screensFailed: false,
  });
  if (load.active !== active) {
    setLoad({active, themesFailed: false, screensFailed: false});
  }
  const reportLoad = (notice: Notice): void => {
    if (notice.key === 'screens:load:themes') {
      setLoad(previous => ({...previous, themesFailed: true}));
    } else if (notice.key === 'screens:load:screens') {
      setLoad(previous => ({...previous, screensFailed: true}));
    }
    onProblem?.(notice);
  };
  const document = useSettingsDocument(
    active ? 'themes' : null,
    '테마',
    reportLoad,
  );
  const screens = useScreenList(reportLoad, active);
  return {
    document,
    themesFailed: load.themesFailed,
    screensReady:
      screens !== null || load.screensFailed || window.llp === undefined,
    screens: screens ?? [],
  };
}
