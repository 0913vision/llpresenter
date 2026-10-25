const SOFTWARE_RENDERING_ARGS = ['--use-gl=angle', '--use-angle=swiftshader'];

/** Uses Chromium's CPU graphics driver only for Electron test launches in CI. */
export function electronTestArgs(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  return env['GITHUB_ACTIONS'] === 'true'
    ? [...args, ...SOFTWARE_RENDERING_ARGS]
    : [...args];
}
