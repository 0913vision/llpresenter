/** What a name field says while it is empty. */
export const EMPTY_NAME_REASON = '이름을 적어야 저장할 수 있습니다.';

/** What a name field says while its name is over its limit. */
export const LONG_NAME_REASON = '이름이 너무 깁니다.';

/**
 * Why a name can't be saved, or undefined when it can: every name field of
 * the app asks this one question. The name counts without the spaces around
 * it.
 */
export function nameReason(
  name: string,
  maxLength: number | undefined,
): string | undefined {
  const trimmed = name.trim();
  if (trimmed === '') return EMPTY_NAME_REASON;
  return maxLength !== undefined && trimmed.length > maxLength
    ? LONG_NAME_REASON
    : undefined;
}
