import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {LlpApi} from '@shared/ipc';
import type {TranslationId} from '@shared/schema/ids';
import type {
  BibleLookupPassage,
  BibleLookupReply,
} from '@shared/schema/bibleLookup';
import {LatestLookup} from './LatestLookup';

export function useBibleLookup({
  api,
  input,
  translation,
  onPreview,
}: {
  readonly api: LlpApi['bible'];
  readonly input: string;
  readonly translation: TranslationId | undefined;
  readonly onPreview: (passage: BibleLookupPassage) => void;
}) {
  const [reply, setReply] = useState<BibleLookupReply | null>(null);
  const reader = useRef<LatestLookup | null>(null);
  const preview = useEffectEvent(onPreview);
  useEffect(() => {
    const lookup = new LatestLookup(
      api,
      answer => {
        setReply(answer);
        if (answer.result.ok) preview(answer.result.value);
      },
      (request, error) => {
        console.error('Could not look up a Bible passage', error);
        setReply({
          ...request,
          suggestions: [],
          result: {
            ok: false,
            error: {
              code: 'translation',
              message: '성경 구절을 불러올 수 없습니다',
            },
          },
        });
      },
    );
    reader.current = lookup;
    return () => {
      lookup.dispose();
      reader.current = null;
    };
  }, [api]);
  useEffect(() => {
    reader.current?.request(
      translation === undefined ? null : {input, translation},
    );
  }, [api, input, translation]);
  return reply?.input === input && reply.translation === translation
    ? reply
    : null;
}
