import type {Layer, LayerMap} from './layer-rule.mts';
import type {ModuleMap} from './module-rule.mts';

const RENDERER = 'src/renderer/src';

const ALIASES = {
  '@core/': 'src/core',
  '@contracts/': 'src/contracts',
  '@renderer/': RENDERER,
  '@main/': 'src/main',
};

/** Folders of core whose files every module of core uses. */
const CORE_BASE = ['common', 'schema'];

/** The modules of core, each with the modules it builds on. */
const CORE_MODULES: Readonly<Record<string, readonly string[]>> = {
  app: [],
  bible: [],
  canvas: [],
  hymns: [],
  live: ['overlays'],
  macros: [],
  media: [],
  output: [],
  overlays: [],
  presentation: ['slides', 'theme'],
  screens: [],
  search: [],
  services: ['presentation'],
  shortcuts: [],
  slides: ['bible', 'hymns', 'labels', 'theme'],
  songs: [],
  theme: ['canvas'],
  timers: [],
};

function coreLayer(name: string, imports: readonly string[]): Layer {
  return {
    name: `core/${name}`,
    dir: `src/core/${name}`,
    imports: imports.map(other => `core/${other}`),
  };
}

const CORE_LAYERS: readonly Layer[] = [
  coreLayer('common', []),
  coreLayer('labels', []),
  coreLayer('schema', ['common', 'labels']),
  ...Object.entries(CORE_MODULES).map(([name, imports]) =>
    coreLayer(name, [...CORE_BASE, ...imports]),
  ),
];

const CORE = CORE_LAYERS.map(layer => layer.name);

/** The modules of main, each with the modules it builds on beside `base`. */
const MAIN_MODULES: Readonly<Record<string, readonly string[]>> = {
  displays: [],
  fonts: [],
  search: [],
  bible: [],
  store: [],
  uiState: ['store'],
  live: ['store'],
  macros: ['live'],
  media: ['store', 'uiState'],
  import: ['store', 'uiState'],
  outputs: ['displays', 'live', 'store'],
  update: ['live'],
  windows: ['outputs', 'store'],
  soak: ['outputs'],
};

/** Shared by every process: pure rules, then the contracts between processes. */
const SHARED = [...CORE, 'contracts'];

function mainLayer(name: string, imports: readonly string[]): Layer {
  return {
    name: `main/${name}`,
    dir: `src/main/${name}`,
    imports: [...SHARED, ...imports.map(other => `main/${other}`)],
  };
}

const MAIN_MODULE_LAYERS = Object.entries(MAIN_MODULES).map(([name, imports]) =>
  mainLayer(name, ['base', ...imports]),
);

/**
 * Main from the most basic to the most composed: `base` is what every module
 * shares, `application` puts the modules together, and the entry starts it.
 */
const MAIN_LAYERS: readonly Layer[] = [
  mainLayer('base', []),
  ...MAIN_MODULE_LAYERS,
  mainLayer('application', [
    'base',
    ...MAIN_MODULE_LAYERS.map(layer => layer.name.slice('main/'.length)),
  ]),
  {
    name: 'main',
    dir: 'src/main',
    imports: [...SHARED, 'main/base', 'main/windows', 'main/application'],
  },
];

const MAIN = MAIN_LAYERS.map(layer => layer.name);

/** Renderer layers that every renderer feature may use. */
const FEATURE_BASE = [
  ...SHARED,
  'ui',
  'platform',
  'session',
  'rendering',
  'pictures',
];

/**
 * The renderer features from the most basic to the most composed. A feature
 * imports only the features to its left.
 */
export const FEATURE_ORDER = [
  'media',
  'songs',
  'bible',
  'service',
  'presentation',
  'screens',
  'tools',
  'quick',
] as const;

const FEATURE_LAYERS = FEATURE_ORDER.map((feature, index): Layer => ({
  name: `features/${feature}`,
  dir: `${RENDERER}/features/${feature}`,
  imports: [
    ...FEATURE_BASE,
    ...FEATURE_ORDER.slice(0, index).map(left => `features/${left}`),
  ],
}));

const ALL_FEATURES = FEATURE_LAYERS.map(layer => layer.name);

/**
 * The layers of the code (docs/TECH.md, "Code structure"). `core` holds pure
 * rules, `contracts` the IPC and file contracts, and each process builds on
 * them. In the control window, `app` composes the features, which build on
 * `session`, `platform`, and `ui`; `rendering` draws for both the previews and
 * the output window, and `pictures` shows what it draws in the control window.
 */
export const LAYER_MAP: LayerMap = {
  aliases: ALIASES,
  layers: [
    ...CORE_LAYERS,
    {name: 'contracts', dir: 'src/contracts', imports: CORE},
    ...MAIN_LAYERS,
    {name: 'preload', dir: 'src/preload', imports: SHARED},
    {name: 'ui', dir: `${RENDERER}/ui`, imports: SHARED},
    {name: 'rendering', dir: `${RENDERER}/rendering`, imports: SHARED},
    {name: 'platform', dir: `${RENDERER}/platform`, imports: [...SHARED, 'ui']},
    {
      name: 'session',
      dir: `${RENDERER}/session`,
      imports: [...SHARED, 'ui', 'platform'],
    },
    {
      name: 'pictures',
      dir: `${RENDERER}/pictures`,
      imports: [...SHARED, 'ui', 'platform', 'rendering'],
    },
    ...FEATURE_LAYERS,
    {
      name: 'app',
      dir: `${RENDERER}/app`,
      imports: [...FEATURE_BASE, ...ALL_FEATURES],
    },
    {
      name: 'output',
      dir: `${RENDERER}/output`,
      imports: [...SHARED, 'rendering'],
    },
    {name: 'analysis', dir: `${RENDERER}/analysis`, imports: [...SHARED, 'ui']},
    {
      name: 'gallery',
      dir: `${RENDERER}/gallery`,
      imports: [...FEATURE_BASE, ...ALL_FEATURES],
    },
  ],
};

/** The modules whose inside is private (`llp/module-entry`). */
export const MODULE_MAP: ModuleMap = {
  aliases: ALIASES,
  areas: [{dir: 'src/core', open: CORE_BASE}],
};

const RENDERER_LAYERS = LAYER_MAP.layers
  .filter(layer => layer.dir.startsWith(`${RENDERER}/`))
  .map(layer => layer.name);

function testImports(layer: Layer): readonly string[] {
  if (CORE.includes(layer.name)) return CORE;
  if (MAIN.includes(layer.name)) return [...SHARED, ...MAIN];
  return layer.dir.startsWith(`${RENDERER}/`)
    ? [...SHARED, ...RENDERER_LAYERS]
    : layer.imports;
}

const TEST_FOLDERS: Readonly<Record<string, string>> = {
  core: 'src/core',
  contracts: 'src/contracts',
  main: 'src/main',
  preload: 'src/preload',
  renderer: RENDERER,
};

/**
 * The layers that tests may import. A test in `test/` mirrors the folder of
 * the code it tests and may render or call any layer of the same process
 * around it, but never another process's code. Fixtures in `test/fixtures/`
 * follow the same rule.
 */
export const TEST_LAYER_MAP: LayerMap = {
  aliases: {...ALIASES, '@fixtures/': 'test/fixtures'},
  mirrors: Object.fromEntries(
    Object.entries(TEST_FOLDERS).flatMap(([area, dir]) => [
      [`test/${area}`, dir],
      [`test/fixtures/${area}`, dir],
    ]),
  ),
  layers: LAYER_MAP.layers.map(layer => ({
    ...layer,
    imports: testImports(layer),
  })),
};
