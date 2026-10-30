import {useEffect, useRef, useState, type JSX} from 'react';
import type {TranslationId} from '@core/schema/ids';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {selectTile, useShow} from '@renderer/state/show';
import {useLive} from '@renderer/platform/live';
import {bibleSourceFor} from '@renderer/state/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from '@renderer/state/showOutput';
import {CheckRow} from '@renderer/ui/Checkbox';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {openBiblePassage} from './actions';
import type {BibleSource} from '@core/bible/source';
import styles from './BiblePanel.module.css';

/** Changes this preview's supported display options without changing defaults. */
export function BibleDisplayControls({
  source,
}: {
  readonly source: BibleSource;
}): JSX.Element {
  const api = window.llp;
  const [readFailed, setReadFailed] = useState(false);
  const document = useSettingsDocument('bible', '성경', () =>
    setReadFailed(true),
  );
  const lifetime = useRef({active: true});
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  useEffect(() => {
    const owner = lifetime.current;
    owner.active = true;
    return () => {
      owner.active = false;
    };
  }, []);
  const translations = document?.value.translations ?? [];
  const changeTranslation = async (
    translation: TranslationId,
  ): Promise<void> => {
    if (!api || locked.current || translation === source.passage.translation) {
      return;
    }
    locked.current = true;
    setBusy(true);
    setProblem(undefined);
    const owner = lifetime.current;
    const request = beginOutputRequest();
    const commandVersion = useLive.getState().commandVersion;
    const initial = useShow.getState();
    const current = (): boolean => {
      const view = useShow.getState();
      return (
        owner.active &&
        bibleSourceFor(view, view.openItemId) === source &&
        view.selectedTile === initial.selectedTile &&
        isOutputRequestCurrent(request, commandVersion)
      );
    };
    try {
      const reply = await withinLookupTimeout(() =>
        api.bible.lookup({translation, input: source.passage.ref}),
      );
      if (!current()) return;
      if (!reply.result.ok) throw Error(reply.result.error.message);
      const passage = reply.result.value;
      const selected = source.passage.verses[initial.selectedTile];
      const next =
        selected === undefined
          ? 0
          : passage.verses.findIndex(
              verse =>
                verse.chapter > selected.chapter ||
                (verse.chapter === selected.chapter &&
                  verse.verse >= selected.verse),
            );
      openBiblePassage(passage, {
        verseNumbers: source.verseNumbers,
        enteredRef: source.enteredRef ?? source.passage.ref,
        enteredTranslation:
          source.enteredTranslation ?? source.passage.translation,
      });
      selectTile(next < 0 ? passage.verses.length - 1 : next);
    } catch (cause) {
      if (current()) {
        api.log.write({
          level: 'error',
          message: 'Could not change the Bible preview translation',
          detail: String(cause),
        });
        setProblem('역본 조회 실패');
      }
    } finally {
      if (owner.active) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const reason = !api
    ? '구절 조회 불가'
    : busy
      ? '역본 조회 중'
      : document === null
        ? readFailed
          ? '역본 정보 조회 실패'
          : '역본 정보 대기'
        : translations.length === 0
          ? '설치된 역본 없음'
          : problem;
  return (
    <div className={styles.options}>
      <SelectMenu
        aria-label="역본"
        size="sm"
        className={styles.translation}
        value={source.passage.translation}
        valueText={
          translations.find(item => item.id === source.passage.translation)
            ?.name ?? source.passage.translation
        }
        options={translations.map(item => ({value: item.id, label: item.name}))}
        disabled={
          !api || busy || document === null || translations.length === 0
        }
        title={reason}
        onChange={translation => {
          changeTranslation(translation).catch((cause: unknown) =>
            console.error('Could not change the Bible preview', cause),
          );
        }}
      />
      <CheckRow
        label="절 번호"
        checked={source.verseNumbers}
        disabled={!api || busy}
        onChange={verseNumbers => {
          openBiblePassage(source.passage, {
            verseNumbers,
            enteredRef: source.enteredRef,
            enteredTranslation: source.enteredTranslation,
          });
        }}
      />
    </div>
  );
}
