import type {Translation} from '@core/schema/bible/bible';
import {LIVE_BIBLE_ID, type TranslationId} from '@core/schema/common/ids';
import {LIVE_BIBLE_TEXT} from './liveTranslation';

/**
 * The 기본 역본 of 환경설정 \> 성경: the translation marked 기본, else the first
 * one listed; none when nothing is listed.
 */
export function defaultTranslationOf(
  translations: readonly Translation[],
): TranslationId | undefined {
  return (translations.find(item => item.default) ?? translations[0])?.id;
}

/** The text a translation holds: the live Bible holds 개역개정. */
function textOf(
  translation: TranslationId,
  translations: readonly Translation[],
): string | undefined {
  return translation === LIVE_BIBLE_ID
    ? LIVE_BIBLE_TEXT
    : translations.find(item => item.id === translation)?.name;
}

/**
 * Whether a new passage shows its translation name: every translation but the
 * 기본 역본 does (user decision, November 24). The live 개역개정 counts as the
 * 기본 역본 when that is 개역개정 too. The operator can still turn the name on
 * or off for one passage.
 */
export function showsTranslationName(
  translation: TranslationId,
  translations: readonly Translation[],
): boolean {
  const base = defaultTranslationOf(translations);
  if (base === undefined || translation === base) return false;
  const text = textOf(translation, translations);
  return text === undefined || text !== textOf(base, translations);
}
