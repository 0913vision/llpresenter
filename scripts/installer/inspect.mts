import {listPackage, extractFile} from '@electron/asar';
import {createHash} from 'node:crypto';
import {access, readdir, readFile, stat, writeFile} from 'node:fs/promises';
import {join, normalize, resolve} from 'node:path';

if (process.env.GITHUB_ACTIONS !== 'true') {
  throw new Error('Installer inspection runs on GitHub runners only');
}
const folder = resolve('artifacts/installer');
const unpacked = join(folder, 'win-unpacked');
const archive = join(unpacked, 'resources/app.asar');
const entries = listPackage(archive, {isPack: false}).map(path =>
  path.replaceAll('\\', '/').replace(/^\//u, ''),
);
const required = [
  'out/main/index.js',
  'out/main/ndi/utility.cjs',
  'out/main/ndi/dirty.cjs',
  'out/main/ndi/ndi-library.cjs',
  'out/preload/index.js',
  'out/renderer/index.html',
  'out/renderer/output.html',
  'out/renderer/analysis.html',
];
for (const file of required) {
  if (!entries.includes(file)) {
    throw new Error(`Missing packaged entry: ${file}`);
  }
}
await access(
  join(
    unpacked,
    'resources/app.asar.unpacked/node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.node',
  ),
);
const fonts = entries.filter(path =>
  /^out\/renderer\/assets\/.*\.woff2$/u.test(path),
);
if (fonts.length === 0) throw new Error('Missing emitted renderer fonts');
if (
  !entries.some(path => /^out\/main\/.*\.(png|jpg|webp)$/u.test(path)) &&
  !entries.some(path =>
    /^out\/renderer\/assets\/.*\.(png|jpg|webp)$/u.test(path),
  )
) {
  throw new Error('Missing emitted pictures');
}
const forbidden = entries.filter(path =>
  /(?:^|\/)(?:\.llp|tests?|logs|userData|coverage)(?:\/|$)|\.(?:llbible|gguf|log)$/iu.test(
    path,
  ),
);
if (forbidden.length !== 0) {
  throw new Error(`Forbidden archive paths: ${forbidden.join(', ')}`);
}
for (const font of fonts) {
  if (extractFile(archive, normalize(font)).byteLength === 0) {
    throw new Error(`Empty font: ${font}`);
  }
}
for (const notice of [
  'Pretendard-OFL.txt',
  'Phosphor-MIT.txt',
  'Koffi-MIT.txt',
]) {
  if (
    (await readFile(join(unpacked, 'resources/notices', notice), 'utf8'))
      .length < 100
  ) {
    throw new Error(`Missing notice: ${notice}`);
  }
}
async function bytesIn(directory: string): Promise<number> {
  let total = 0;
  for (const entry of await readdir(directory, {withFileTypes: true})) {
    const path = join(directory, entry.name);
    total += entry.isDirectory()
      ? await bytesIn(path)
      : (await stat(path)).size;
  }
  return total;
}
const installers = (await readdir(folder)).filter(name =>
  /^LoveLightPresenter-Setup-.*\.exe$/u.test(name),
);
const installer = installers[0];
if (installers.length !== 1 || installer === undefined) {
  throw new Error('Expected one installer');
}
const payload = await readFile(join(folder, installer));
const report = {
  commit: process.env.GITHUB_SHA,
  installer,
  installerBytes: payload.byteLength,
  installedBytes: await bytesIn(unpacked),
  sha256: createHash('sha256').update(payload).digest('hex'),
  icon: 'Electron default (no design system app icon)',
  archiveSample: [...required, ...fonts.slice(0, 3)],
};
await writeFile(join(folder, 'archive-list.txt'), entries.join('\n'));
await writeFile(
  join(folder, 'build-info.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
console.log(
  `::notice file=scripts/installer/inspect.mts,title=Installer size and archive report::${JSON.stringify(report).replaceAll('%', '%25')}`,
);
