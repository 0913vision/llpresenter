const {app, screen} = require('electron');
const process = require('node:process');
const console = require('node:console');
const {
  readFileSync,
  writeFileSync,
  renameSync,
  realpathSync,
} = require('node:fs');
const {join, resolve, relative, isAbsolute, dirname} = require('node:path');

function copiedRoot() {
  if (process.env.LLP_TEST_WINDOWS !== 'offscreen') {
    throw new Error(
      'Set LLP_TEST_WINDOWS=offscreen for this windowless helper',
    );
  }
  const folder = process.env.LLP_USER_DATA;
  if (!folder) throw new Error('Set LLP_USER_DATA to the copied QA sample');
  const root = realpathSync(folder);
  const repository = resolve(dirname(process.argv[1]), '../../..');
  const within = relative(repository, root);
  if (!within.startsWith('..') && !isAbsolute(within)) {
    throw new Error('Use a copied sample outside the repository');
  }
  const config = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  if (config.lastServiceId !== '4e6b8a0c-2d4f-4b6a-9c8d-9e0f1a2b3c44') {
    throw new Error('Expected the unmodified M3 QA sample');
  }
  return root;
}

function configure() {
  const root = copiedRoot();
  const primary = screen.getPrimaryDisplay();
  const displays = screen.getAllDisplays();
  const external = displays.find(display => display.id !== primary.id);
  if (!external) {
    console.log('두 번째 모니터가 없습니다. 샘플의 창 출력을 유지합니다.');
    return;
  }
  const file = join(root, 'LoveLight', '설정', 'screens.json');
  const document = JSON.parse(readFileSync(file, 'utf8'));
  if (
    document.format !== 'llsettings.screens' ||
    !Array.isArray(document.screens)
  ) {
    throw new Error('Invalid screen fixture');
  }
  const main = document.screens.find(
    item => item.id === '00000000-0000-4000-8000-000000000001',
  );
  if (!main) throw new Error('Missing main screen fixture');
  main.method = 'fullscreen';
  main.alwaysOnTop = true;
  main.display = {
    id: external.id,
    name: external.label || '',
    number: displays.indexOf(external) + 1,
    bounds: external.bounds,
    scaleFactor: external.scaleFactor,
  };
  const temporary = `${file}.qa-tmp`;
  writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, {
    flush: true,
  });
  renameSync(temporary, file);
  console.log(`본 화면: ${external.label || external.id}, 전체 화면, 항상 위`);
}

let readyToConfigure = false;
try {
  if (
    process.env.LLP_TEST_WINDOWS !== 'offscreen' ||
    !process.env.LLP_USER_DATA
  ) {
    throw new Error('Set LLP_TEST_WINDOWS=offscreen and LLP_USER_DATA first');
  }
  app.setPath('userData', copiedRoot());
  readyToConfigure = true;
} catch (error) {
  console.error(error.message);
  app.exit(1);
}

if (readyToConfigure) {
  app.whenReady().then(() => {
    try {
      configure();
      app.exit(0);
    } catch (error) {
      console.error(error.message);
      app.exit(1);
    }
  });
}
