import {useEffect, useEffectEvent} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  PlaybackProblems,
  PlaybackProblemKind,
} from '@core/schema/playbackProblems';
import {
  dropOutputWarning,
  keepOutputWarning,
} from '@renderer/platform/outputWarnings';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import type {NoticeTarget} from './useOutputNotices';

/** Keeps current playback failures in the same cards and output menu as monitor failures. */
export function usePlaybackNotices(
  api: Pick<LlpApi, 'output'> | undefined,
  target: NoticeTarget,
): void {
  const report = useEffectEvent(target.report);
  const dismiss = useEffectEvent(target.dismiss);
  useEffect(() => {
    if (api === undefined) return undefined;
    let stopped = false;
    let pushed = false;
    let previous = new Map<string, string>();
    const receive = (problems: PlaybackProblems): void => {
      if (stopped) return;
      const next = new Map<string, string>();
      for (const problem of problems) {
        const {source, name, kinds, renderer} = problem;
        const titles = {
          playback:
            source === 'audio'
              ? '오디오 재생 실패'
              : `${name} 미디어 재생 실패`,
          'device-missing': '오디오 출력 장치 연결 끊김',
          'device-failed': '오디오 출력 장치 변경 실패',
          'font-missing': `${name} 글꼴 없음`,
          'theme-missing': `${name} 테마 없음`,
          'media-missing': `${name} 테마 미디어 읽기 실패`,
          restarting: '오디오 다시 시작 중',
          limited: '오디오 다시 시작 중단',
        };
        const current: ReadonlyArray<
          PlaybackProblemKind | 'restarting' | 'limited'
        > = renderer === 'running' ? kinds : [renderer];
        for (const kind of current) {
          const key = `playback:${source}:${kind}`;
          const title = titles[kind];
          const fallback =
            kind === 'device-missing' && !kinds.includes('device-failed');
          const signature = JSON.stringify([title, fallback]);
          next.set(key, signature);
          if (previous.get(key) === signature) continue;
          const card: Notice = {
            key,
            kind: 'warning',
            icon: 'warning',
            title,
            time: noticeTime(),
            ...(fallback ? {meta: ['Windows 기본 장치로 재생 중']} : {}),
            ...(kind === 'restarting'
              ? {}
              : {
                  actions: [
                    {
                      icon: 'refresh',
                      label: '다시 시도',
                      onSelect: () => {
                        if (!previous.has(key) || stopped) return;
                        api.output.retryPlayback({source});
                        report(card);
                      },
                    },
                  ],
                }),
          };
          keepOutputWarning({screenId: source, screenName: name, notice: card});
          report(card);
        }
      }
      for (const key of previous.keys()) {
        if (next.has(key)) continue;
        dropOutputWarning(key);
        dismiss(key);
      }
      previous = next;
    };
    const stop = api.output.subscribePlaybackProblems(problems => {
      pushed = true;
      receive(problems);
    });
    api.output.getPlaybackProblems().then(
      problems => {
        if (!pushed) receive(problems);
      },
      () => undefined,
    );
    return () => {
      stopped = true;
      stop();
      for (const key of previous.keys()) dropOutputWarning(key);
    };
  }, [api]);
}
