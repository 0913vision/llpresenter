import type {Linter} from 'eslint';

/**
 * Rules switched off for spots in existing code that break them, each as
 * narrow as possible. The code's author fixes the spot and deletes the entry.
 */
export const legacyExclusions: readonly Linter.Config[] = [
  {
    // TODO(0913vision): These renderer tests build live states with main's
    // LiveStore, load the real preload, or start Electron. Move the pure live
    // reducers to src/core with the M4 theme work and the rest to an
    // integration folder, then delete this entry.
    files: [
      'src/renderer/src/output/startOutput.test.ts',
      'src/renderer/src/rendering/overlayLayers.test.ts',
      'src/renderer/src/rendering/previewOverlays.test.tsx',
      'src/renderer/src/rendering/transparentBackground.node.test.ts',
      'src/renderer/src/session/servicePreload.test.ts',
      'src/renderer/src/session/songBackground.test.ts',
    ],
    rules: {'llp/test-layer-imports': 'off'},
  },
];
