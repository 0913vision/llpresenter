import type {BibleFile, Translation} from '@core/schema/bible';
import {useSettingsDocument} from '@renderer/platform/useSettingsDocument';
import type {Notice} from '@renderer/ui/notices';
import {NEWER_FILE_REASON} from './usePreferenceEdits';
import {useQueuedWrites} from './useQueuedWrites';

const TITLE = '성경';
const SAVE_FAILURE: Notice = {
  key: 'preferences:bible-save',
  kind: 'warning',
  icon: 'warning',
  title: '기본 역본을 저장하지 못함',
  time: '',
};

export interface BibleEdits {
  /** The installed translations; null until the first read. */
  readonly translations: readonly Translation[] | null;
  readonly lockedReason: string | undefined;
  /** Makes one translation the default, and no other. */
  readonly makeDefault: (id: Translation['id']) => void;
}

/** The file with exactly one default: the translation of that id. */
export function withDefaultTranslation(
  stored: BibleFile,
  id: Translation['id'],
): BibleFile {
  return {
    ...stored,
    translations: stored.translations.map(translation =>
      translation.default === (translation.id === id)
        ? translation
        : {...translation, default: translation.id === id},
    ),
  };
}

/** Reads the installed translations and saves the default one at once. */
export function useBibleEdits(onProblem: (notice: Notice) => void): BibleEdits {
  const document = useSettingsDocument('bible', TITLE, onProblem);
  const change = useQueuedWrites({
    document,
    send: (base, value) =>
      window.llp === undefined
        ? Promise.reject(new Error('The window has no api'))
        : window.llp.settings.edit({
            type: 'settings.update',
            name: 'bible',
            baseRevision: base.revision,
            value,
          }),
    failure: SAVE_FAILURE,
    onProblem,
  });
  return {
    translations: document === null ? null : document.value.translations,
    lockedReason:
      document?.access === 'readOnly' ? NEWER_FILE_REASON : undefined,
    makeDefault: id => change(stored => withDefaultTranslation(stored, id)),
  };
}
