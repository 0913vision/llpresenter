import {useScreenList} from '@renderer/platform/screens/useScreenList';
import {useMemo} from 'react';
import {useSettingsDocument} from '@renderer/platform/documents/useSettingsDocument';
import type {Notice} from '@renderer/ui/popups/notices';
import {buildMacroTargets} from './macroTargets';
import {useMediaDocument} from '../../useMediaDocument';

/**
 * The targets a 동작 can point at, or null until the documents they come from are
 * read.
 */
export function useMacroTargets(
  onProblem: ((notice: Notice) => void) | undefined,
): ReturnType<typeof buildMacroTargets> | null {
  const themes = useSettingsDocument('themes', '테마', onProblem);
  const props = useSettingsDocument('props', '그래픽', onProblem);
  const messages = useSettingsDocument('messages', '메시지', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const macros = useSettingsDocument('macros', '매크로', onProblem);
  const screens = useScreenList(onProblem);
  const media = useMediaDocument(onProblem, 'macro');
  return useMemo(() => {
    if (
      !themes ||
      !props ||
      !messages ||
      !timers ||
      !macros ||
      !screens ||
      !media
    ) {
      return null;
    }
    return buildMacroTargets({
      themes: themes.value,
      props: props.value,
      messages: messages.value,
      timers: timers.value,
      macros: macros.value,
      screens,
      media: media.value,
    });
  }, [themes, props, messages, timers, macros, screens, media]);
}
