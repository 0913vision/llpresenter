/** The variable a user check run sets to `on` to hear an unpackaged build. */
export const SOUND_OPT_IN = 'LLP_SOUND';

/**
 * Development and test processes must never produce sound on this PC. A
 * user check of an unpackaged build opts in with `LLP_SOUND=on`; test runs
 * stay silent even then.
 */
export function audioMutedByDefault(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): boolean {
  const testRun =
    env['NODE_ENV'] === 'test' ||
    env['VITEST'] !== undefined ||
    env['LLP_TEST_WINDOWS'] !== undefined;
  if (testRun) return true;
  return !isPackaged && env[SOUND_OPT_IN] !== 'on';
}
