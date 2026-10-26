import type {AppProblemOf} from '@shared/schema/appProblem';
import type {Notice} from '@renderer/ui/notices';

/** One card stands for every data file skipped so far. */
export const SKIPPED_FILES_KEY = 'file-skipped';

/** One card stands for every file that waits to be saved. */
export const WAITING_SAVES_KEY = 'save-failed';

const UNNAMED_MACRO = '이름 없는 매크로';

/**
 * The 파일을 읽을 수 없음 card for the skipped files, in the order they came:
 * the first name, and how many more there are (spec 08, "File can't be
 * read"). Gives nothing when no file was skipped.
 */
export function skippedFilesCard(
  names: readonly string[],
  time: string,
): Notice | null {
  const [first] = names;
  if (first === undefined) return null;
  return {
    key: SKIPPED_FILES_KEY,
    kind: 'warning',
    icon: 'filex',
    title: '파일을 읽을 수 없음',
    time,
    meta: [nameWithMore(first, names.length), '건너뜀'],
  };
}

function nameWithMore(name: string, count: number): string {
  return count <= 1 ? name : `${name} 외 ${count - 1}개`;
}

/**
 * The 저장할 수 없음 card for the files that wait in memory: the oldest one's
 * name and how many more, with 다시 시도 (spec 02, "Save failures").
 */
export function waitingSavesCard(
  {name, count}: AppProblemOf<'save-failed'>,
  {time, retry}: {readonly time: string; readonly retry: () => void},
): Notice {
  return {
    key: WAITING_SAVES_KEY,
    kind: 'warning',
    icon: 'warning',
    title: '저장할 수 없음',
    time,
    meta: [nameWithMore(name, count)],
    actions: [{icon: 'refresh', label: '다시 시도', onSelect: retry}],
  };
}

/**
 * The 매크로 적용 실패 card for a dispatch that was dropped whole (spec 08);
 * the same 매크로 again replaces its card.
 */
export function macroDroppedCard(
  {macroId, name}: AppProblemOf<'macro-dropped'>,
  time: string,
): Notice {
  return {
    key: `macro-dropped:${macroId}`,
    kind: 'warning',
    icon: 'macro',
    title: '매크로 적용 실패',
    time,
    meta: [name === '' ? UNNAMED_MACRO : name],
  };
}
