import type {Layer, LayerMap} from './layer-rule.mts';

const RENDERER = 'src/renderer/src';

/** Shared by every process: pure rules, then the contracts between processes. */
const SHARED = ['core', 'contracts'];

/** Renderer layers that every renderer feature may use. */
const FEATURE_BASE = [...SHARED, 'ui', 'platform', 'session', 'rendering'];

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
 * the output window.
 */
export const LAYER_MAP: LayerMap = {
  aliases: {
    '@core/': 'src/core',
    '@contracts/': 'src/contracts',
    '@renderer/': RENDERER,
  },
  layers: [
    {name: 'core', dir: 'src/core', imports: []},
    {name: 'contracts', dir: 'src/contracts', imports: ['core']},
    {name: 'main', dir: 'src/main', imports: SHARED},
    {name: 'preload', dir: 'src/preload', imports: SHARED},
    {name: 'ui', dir: `${RENDERER}/ui`, imports: SHARED},
    {name: 'rendering', dir: `${RENDERER}/rendering`, imports: SHARED},
    {name: 'platform', dir: `${RENDERER}/platform`, imports: [...SHARED, 'ui']},
    {
      name: 'session',
      dir: `${RENDERER}/session`,
      imports: [...SHARED, 'ui', 'platform'],
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

const RENDERER_LAYERS = LAYER_MAP.layers
  .filter(layer => layer.dir.startsWith(`${RENDERER}/`))
  .map(layer => layer.name);

function testImports(layer: Layer): readonly string[] {
  return layer.dir.startsWith(`${RENDERER}/`)
    ? [...SHARED, ...RENDERER_LAYERS]
    : layer.imports;
}

/**
 * The layers that tests may import. A test sits beside the code it tests and
 * may render or call any layer of the same process around it, but never
 * another process's code.
 */
export const TEST_LAYER_MAP: LayerMap = {
  aliases: LAYER_MAP.aliases,
  layers: LAYER_MAP.layers.map(layer => ({
    ...layer,
    imports: testImports(layer),
  })),
};
