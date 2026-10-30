import {useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import type {MediaDocument} from '@core/schema/mediaEdit';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {noticeTime, type Notice} from '@renderer/ui/notices';
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
    let active = true;
    let revision = -1;
    const accept = (next: MediaDocument): void => {
      if (!active || next.revision <= revision) return;
      revision = next.revision;
      setDocument(next);
    };
    const stop = api.media.subscribe(accept);
    api.media.get().then(accept, (cause: unknown) => {
      if (!active || revision >= 0) return;
      api.log.write({
        level: 'error',
        message: 'Could not load macro media',
        detail: String(cause),
      });
      report.current?.({
        key: 'macro:media',
        kind: 'warning',
        icon: 'warning',
        title: '\ubbf8\ub514\uc5b4 \ubd88\ub7ec\uc624\uae30 \uc2e4\ud328',
        time: noticeTime(),
      });
    });
    return () => {
      active = false;
      stop();
    };
  }, []);
  return document;
}

export function useMacroTargets(
  onProblem: ((notice: Notice) => void) | undefined,
): ReturnType<typeof buildMacroTargets> | null {
  const looks = useSettingsDocument('looks', '\ub8e9', onProblem);
  const layouts = useSettingsDocument(
    'stage-layouts',
    '\ubb34\ub300 \ub808\uc774\uc544\uc6c3',
    onProblem,
  );
  const props = useSettingsDocument('props', '\uc18c\ud488', onProblem);
  const messages = useSettingsDocument(
    'messages',
    '\uba54\uc2dc\uc9c0',
    onProblem,
  );
  const notices = useSettingsDocument('notices', '\uacf5\uc9c0', onProblem);
  const timers = useSettingsDocument('timers', '\ud0c0\uc774\uba38', onProblem);
  const macros = useSettingsDocument('macros', '\ub9e4\ud06c\ub85c', onProblem);
  const screens = useSettingsDocument('screens', '\ud654\uba74', onProblem);
  const media = useMacroMedia(onProblem);
  return useMemo(() => {
    if (
      !looks ||
      !layouts ||
      !props ||
      !messages ||
      !notices ||
      !timers ||
      !macros ||
      !screens ||
      !media
    ) {
      return null;
    }
    return buildMacroTargets({
      looks: looks.value,
      layouts: layouts.value,
      props: props.value,
      messages: messages.value,
      notices: notices.value,
      timers: timers.value,
      macros: macros.value,
      screens: screens.value.screens,
      media: media.value,
    });
  }, [
    looks,
    layouts,
    props,
    messages,
    notices,
    timers,
    macros,
    screens,
    media,
  ]);
}
