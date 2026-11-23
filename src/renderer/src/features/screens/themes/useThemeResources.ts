import {useState} from 'react';
import {inScreenOrder} from '@core/schema/screens';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {Notice} from '@renderer/ui/notices';

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
  const screensDocument = useSettingsDocument(
    active ? 'screens' : null,
    '화면',
    reportLoad,
  );
  return {
    document,
    themesFailed: load.themesFailed,
    screensReady:
      screensDocument !== null ||
      load.screensFailed ||
      window.llp === undefined,
    screens: inScreenOrder(screensDocument?.value.screens ?? []),
  };
}
