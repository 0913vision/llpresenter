import {useEffect, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {
  TextImportOptions,
  TextImportPreviewResult,
  TextImportSource,
} from '@core/schema/textImport';
import {noticeTime, type Notice} from '@renderer/ui/notices';
import {createLatestRunner} from '../../service/items/latestRunner';

export function useImportPreview({
  api,
  source,
  options,
  onProblem,
}: {
  readonly api: LlpApi['textImport'];
  readonly source: TextImportSource;
  readonly options: TextImportOptions;
  readonly onProblem: (notice: Notice) => void;
}) {
  const [runner] = useState(createLatestRunner);
  const [reply, setReply] = useState<{
    readonly source: TextImportSource;
    readonly options: TextImportOptions;
    readonly result: TextImportPreviewResult;
  } | null>(null);
  const invalidSymbol = options.split === 'symbol' && !options.symbol?.trim();
  useEffect(() => {
    if (invalidSymbol) return;
    let active = true;
    const isActive = (): boolean => active;
    const report = (): void =>
      onProblem({
        key: 'text-import:preview',
        kind: 'warning',
        icon: 'warning',
        title: '가져오기 미리보기 실패',
        time: noticeTime(),
      });
    runner.submit(async () => {
      if (!isActive()) return;
      try {
        const result = await api.preview({source, options});
        if (!isActive()) return;
        setReply({source, options, result});
        if (!result.ok) report();
      } catch (cause: unknown) {
        console.error('Text import preview failed:', cause);
        if (isActive()) {
          setReply({
            source,
            options,
            result: {
              ok: false,
              error: {reason: 'invalid', message: 'Preview unavailable'},
            },
          });
          report();
        }
      }
    });
    return () => {
      active = false;
    };
  }, [api, source, options, onProblem, runner, invalidSymbol]);
  const result =
    !invalidSymbol && reply?.source === source && reply.options === options
      ? reply.result
      : null;
  return {
    draft: result?.ok ? result.value : null,
    pending: !invalidSymbol && result === null,
    invalidSymbol,
  };
}
