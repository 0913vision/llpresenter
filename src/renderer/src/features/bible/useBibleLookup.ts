import {useEffect, useEffectEvent, useRef, useState} from 'react';
import type {LlpApi} from '@contracts/ipc/api';
import type {TranslationId} from '@core/schema/ids';
import type {
  BibleLookupPassage,
  BibleLookupReply,
} from '@core/schema/bibleLookup';
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
  const [key, setKey] = useState({input, translation});
  if (key.input !== input || key.translation !== translation) {
    setKey({input, translation});
    setReply(null);
  }
  const reader = useRef<LatestLookup | null>(null);
  const accept = useEffectEvent((answer: BibleLookupReply) => {
    if (answer.input !== input || answer.translation !== translation) return;
    setReply(answer);
    if (answer.result.ok) onPreview(answer.result.value);
  });
  useEffect(() => {
    const lookup = new LatestLookup(
      api,
      answer => {
        accept(answer);
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
  return key.input === input &&
    key.translation === translation &&
    reply?.input === input &&
    reply.translation === translation
    ? reply
    : null;
}
