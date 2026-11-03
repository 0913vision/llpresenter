import {useLayoutEffect} from 'react';
import {withPreferenceDefaults} from '@core/schema/preferences';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {setAtLastSlide} from '@renderer/session/show';

/**
 * Follows 환경설정's choice of what next does on the last 장 and hands it to
 * the next-장 key. Until the file is read the default, stop, holds.
 */
export function useAtLastSlide(): void {
  const document = useSettingsDocument('preferences', '환경설정', undefined);
  const atLast =
    document === null
      ? 'stop'
      : withPreferenceDefaults(document.value).show.atLastSlide;
  useLayoutEffect(() => {
    setAtLastSlide(atLast);
  }, [atLast]);
}
