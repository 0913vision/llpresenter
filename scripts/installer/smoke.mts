import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, access, readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

if (process.env.GITHUB_ACTIONS !== 'true' || process.platform !== 'win32') {
  throw new Error('The packaged smoke runs on a Windows GitHub runner only');
}
const folder = resolve('artifacts/installer');
const data = await mkdtemp(join(tmpdir(), 'llp-installer-smoke-'));
const installers = (await readdir(folder)).filter(name =>
  /^LoveLightPresenter-Setup-.*\.exe$/u.test(name),
);
if (installers.length !== 1) throw new Error('Expected one Windows installer');
const installer = installers[0];
if (installer === undefined) throw new Error('Missing Windows installer');
const installDir = join(data, 'installed');
const install = spawn(join(folder, installer), ['/S', `/D=${installDir}`], {
  windowsHide: true,
  stdio: 'ignore',
});
const installTimer = setTimeout(() => install.kill(), 120000);
try {
  const installCode = await new Promise<number | null>((done, reject) => {
    install.once('error', reject);
    install.once('close', done);
  });
  if (installCode !== 0) {
    throw new Error(`Silent installation failed (exit ${installCode})`);
  }
} finally {
  clearTimeout(installTimer);
}
const executable = join(installDir, 'LoveLightPresenter.exe');
await access(executable);
await access(
  join(
    installDir,
    'resources/app.asar.unpacked/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node',
  ),
);
const cleanEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    ([key]) =>
      ![
        'electron_run_as_node',
        'electron_renderer_url',
        'node_options',
      ].includes(key.toLowerCase()),
  ),
);
// NOTE(0913vision): Match test/fixtures/electronLaunch.ts: the hosted Windows
// runner's default GPU driver crashes before offscreen readiness.
const launchArgs = [
  '--enable-logging=stderr',
  '--v=0',
  '--use-gl=angle',
  '--use-angle=swiftshader',
];
const child = spawn(executable, launchArgs, {
  windowsHide: true,
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...cleanEnv,
    LLP_USER_DATA: data,
    LLP_INSTALLER_SMOKE: '1',
    LLP_TEST_WINDOWS: 'offscreen',
    LLP_SMOKE_EXIT_MS: '15000',
    LLP_SOAK_RECORD: join(data, 'soak.jsonl'),
    LLP_NDI_PRODUCT_TEST: '1',
    NDI_RUNTIME_DIR_V6: join(data, 'missing-ndi-runtime'),
    ELECTRON_RENDERER_URL: 'http://127.0.0.1:1/should-be-ignored',
  },
});
let stdout = '';
let stderr = '';
child.stdout.setEncoding('utf8').on('data', (chunk: string) => {
  stdout = (stdout + chunk).slice(-16_384);
});
child.stderr.setEncoding('utf8').on('data', (chunk: string) => {
  stderr = (stderr + chunk).slice(-32_768);
});
const timeout = setTimeout(() => child.kill(), 60000);
try {
  const code = await new Promise<number | null>((done, reject) => {
    child.once('error', reject);
    child.once('close', done);
  });
  const log = await readFile(join(data, 'logs/main.log'), 'utf8').catch(
    (error: unknown) => `Could not read the app log: ${String(error)}`,
  );
  const readyReached = log.includes('installer smoke ready');
  const ndiNativeLoaded = log.includes('NDI native module loaded');
  await writeFile(
    join(folder, 'smoke.log'),
    `Ready reached: ${readyReached}\nApp log:\n${log}\nStderr:\n${stderr}\nStdout:\n${stdout}`,
  );
  if (
    code !== 0 ||
    !log.includes('smoke ok') ||
    !readyReached ||
    !ndiNativeLoaded ||
    /failed to start|failed to load|uncaught exception|unhandled rejection/u.test(
      log,
    )
  ) {
    annotateFailure('Smoke app log', tail(log, 12));
    annotateFailure('Smoke stderr', tail(stderr, 20));
    annotateFailure('Smoke stdout', tail(stdout, 8));
    throw new Error(
      `Packaged app did not become ready and quit cleanly (exit ${code})\n` +
        `Ready reached: ${readyReached}`,
    );
  }
  const lockPresent = await access(join(data, 'recovery/session.lock')).then(
    () => true,
    () => false,
  );
  if (lockPresent) throw new Error('Smoke shutdown left a recovery lock');
  const result = {
    ready: true,
    exitCode: code,
    windows: 'offscreen',
    graphics: 'angle-swiftshader',
    rendererUrlIgnored: true,
    ndiNativeLoaded: true,
    installedApp: true,
    recoveryLockRemoved: true,
  };
  await writeFile(
    join(folder, 'smoke-result.json'),
    `${JSON.stringify(result, null, 2)}\n`,
  );
  console.log(JSON.stringify(result));
  console.log(
    `::notice file=scripts/installer/smoke.mts,title=Installer smoke result::${JSON.stringify(result)}`,
  );
} finally {
  clearTimeout(timeout);
}

function tail(value: string, lines: number): string {
  return value.trim().split(/\r?\n/u).slice(-lines).join('\n');
}

function annotateFailure(title: string, value: string): void {
  const message = (value.slice(-3000) || '(empty)')
    .replaceAll('%', '%25')
    .replaceAll('\r', '%0D')
    .replaceAll('\n', '%0A');
  console.log(
    `::error file=scripts/installer/smoke.mts,title=${title}::${message}`,
  );
}
