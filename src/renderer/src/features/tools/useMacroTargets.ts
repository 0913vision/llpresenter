import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {subscribeMediaDocument} from '@renderer/features/media/subscribeMediaDocument';
import {buildMacroTargets} from './macroTargets';

function useMacroMedia(
  onProblem: ((notice: Notice) => void) | undefined,
): MediaDocument | null {
  const [document, setDocument] = useState<MediaDocument | null>(null);
  const report = useRef(onProblem);
  useLayoutEffect(() => {
    report.current = onProblem;
  });
  useEffect(() => {
    const api = window.llp;
    if (!api) return undefined;
    return subscribeMediaDocument(api.media, setDocument, (cause: unknown) => {
      api.log.write({
        level: 'error',
        message: 'Could not load macro media',
        detail: String(cause),
      });
      report.current?.({
        key: 'macro:media',
        kind: 'warning',
        icon: 'warning',
        title: '미디어 불러오기 실패',
        time: noticeTime(),
      });
    });
  }, []);
  return document;
}

export function useMacroTargets(
  onProblem: ((notice: Notice) => void) | undefined,
): ReturnType<typeof buildMacroTargets> | null {
  const themes = useSettingsDocument('themes', '테마', onProblem);
  const props = useSettingsDocument('props', '그래픽', onProblem);
  const messages = useSettingsDocument('messages', '메시지', onProblem);
  const timers = useSettingsDocument('timers', '타이머', onProblem);
  const macros = useSettingsDocument('macros', '매크로', onProblem);
  const screens = useSettingsDocument('screens', '화면', onProblem);
  const media = useMacroMedia(onProblem);
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
      screens: screens.value.screens,
      media: media.value,
    });
  }, [themes, props, messages, timers, macros, screens, media]);
}
