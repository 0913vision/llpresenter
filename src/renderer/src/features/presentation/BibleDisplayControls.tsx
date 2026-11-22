import {withLiveBible} from '@core/bible/liveTranslation';
import {useEffect, useRef, useState, type JSX} from 'react';
import type {TranslationId} from '@core/schema/ids';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import {selectTile, useShow} from '@renderer/session/show';
import {useLive} from '@renderer/session/live';
import {bibleSourceFor} from '@renderer/session/showLibrary';
import {
  beginOutputRequest,
  isOutputRequestCurrent,
  withinLookupTimeout,
} from '@renderer/session/showOutput';
import {CheckRow} from '@renderer/ui/Checkbox';
import {SelectMenu} from '@renderer/ui/SelectMenu';
import {openBiblePassage} from '../bible/actions';
import type {BibleDisplay, BibleSource} from '@renderer/session/bibleSource';
import styles from './BiblePanel.module.css';

function displayOf({
  verseNumbers,
  translationName,
  transition,
  review,
  enteredRef,
  enteredTranslation,
}: BibleSource): BibleDisplay {
  return {
    verseNumbers,
    translationName,
    transition,
    review,
    enteredRef,
    enteredTranslation,
  };
}

/** Changes how the passage that is open shows, without changing defaults. */
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
  const translations = withLiveBible(document?.value.translations ?? []);
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
      const selected =
        source.tiles[initial.selectedTile]?.slide.verse ?? undefined;
      const opened = openBiblePassage(passage, {
        ...displayOf(source),
        enteredRef: source.enteredRef ?? source.passage.ref,
        enteredTranslation:
          source.enteredTranslation ?? source.passage.translation,
      });
      const same = opened.tiles.findIndex(
        ({slide}) =>
          slide.verse !== undefined &&
          slide.verse.chapter === selected?.chapter &&
          slide.verse.verse >= selected.verse,
      );
      selectTile(Math.max(0, same));
    } catch (cause) {
      if (current()) {
        api.log.write({
          level: 'error',
          message: 'Could not change the Bible preview translation',
          detail: String(cause),
        });
        setProblem('역본 불러오기 실패');
      }
    } finally {
      if (owner.active) {
        locked.current = false;
        setBusy(false);
      }
    }
  };
  const reason = !api
    ? '구절을 불러올 수 없습니다'
    : busy
      ? '역본 불러오는 중'
      : document === null
        ? readFailed
          ? '역본 불러오기 실패'
          : '역본 불러오는 중'
        : translations.length === 0
          ? '설치된 역본 없음'
          : problem;
  return (
    <div className={styles.options}>
      <div className={styles.translationGroup}>
        <SelectMenu
          aria-label="역본"
          size="sm"
          className={styles.translation}
          value={source.passage.translation}
          valueText={
            translations.find(item => item.id === source.passage.translation)
              ?.name ?? source.passage.translation
          }
          options={translations.map(item => ({
            value: item.id,
            label: item.name,
          }))}
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
      </div>
      <CheckRow
        label="절 번호"
        checked={source.verseNumbers}
        disabled={!api || busy}
        onChange={verseNumbers => {
          openBiblePassage(source.passage, {
            ...displayOf(source),
            verseNumbers,
          });
        }}
      />
      <CheckRow
        label="역본 이름"
        checked={source.translationName ?? false}
        disabled={!api || busy}
        onChange={translationName => {
          openBiblePassage(source.passage, {
            ...displayOf(source),
            translationName,
          });
        }}
      />
    </div>
  );
}
