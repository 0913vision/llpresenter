import {useContext, useEffect, useState, type JSX} from 'react';
import {LoadReadinessContext} from '@renderer/ui/loadReadiness';
import {PropertyGroup, PropertyValue} from '@renderer/ui/panels/PropertyRow';
import {ActionRow, CheckboxRow} from '../PreferenceRows';

const VERSION_LOADING = '확인 중';

/** 정보: 버전, 문제 해결. */
export function AboutPage(): JSX.Element {
  const readiness = useContext(LoadReadinessContext);
  const [version, setVersion] = useState(VERSION_LOADING);
  const [copied, setCopied] = useState<'idle' | 'done' | 'failed'>('idle');
  const [verbose, setVerbose] = useState(false);
  useEffect(() => {
    const api = window.llp?.window;
    if (api === undefined) return undefined;
    const readyLogging = readiness?.begin();
    const readyInfo = readiness?.begin();
    let alive = true;
    api.verboseLogging().then(
      value => {
        if (alive) setVerbose(value);
        readyLogging?.();
      },
      () => readyLogging?.(),
    );
    api.appInfo().then(
      info => {
        if (alive) setVersion(info.version);
        readyInfo?.();
      },
      () => {
        if (alive) setVersion('');
        readyInfo?.();
      },
    );
    return () => {
      alive = false;
      readyLogging?.();
      readyInfo?.();
    };
  }, [readiness]);
  const copy = (): void => {
    const api = window.llp;
    if (api === undefined) return;
    api.window
      .diagnostics()
      .then(text => navigator.clipboard.writeText(text))
      .then(
        () => setCopied('done'),
        () => setCopied('failed'),
      );
  };
  return (
    <>
      <PropertyGroup>
        <PropertyValue label="버전" value={version} />
      </PropertyGroup>
      <PropertyGroup title="문제 해결">
        <ActionRow
          label="기록 폴더"
          action="폴더 열기"
          onAction={() => window.llp?.window.openLogFolder()}
        />
        <ActionRow
          label="진단 정보"
          action="복사"
          result={
            copied === 'done'
              ? '복사했습니다.'
              : copied === 'failed'
                ? '복사하지 못했습니다.'
                : undefined
          }
          onAction={copy}
        />
        <CheckboxRow
          label="자세한 기록"
          title="앱을 다시 켜면 꺼집니다."
          checked={verbose}
          onChange={on => {
            setVerbose(on);
            window.llp?.window.setVerboseLogging(on);
          }}
        />
      </PropertyGroup>
    </>
  );
}
