/** Development and test processes must never produce sound on this PC. */
export function audioMutedByDefault(
  env: NodeJS.ProcessEnv,
  isPackaged: boolean,
): boolean {
  return (
    !isPackaged ||
    env['NODE_ENV'] === 'test' ||
    env['VITEST'] !== undefined ||
    env['LLP_TEST_WINDOWS'] !== undefined
  );
}
