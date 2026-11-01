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
      'test/renderer/output/startOutput.test.ts',
      'test/renderer/rendering/overlayLayers.test.ts',
      'test/renderer/rendering/previewOverlays.test.tsx',
      'test/renderer/rendering/transparentBackground.node.test.ts',
      'test/renderer/session/servicePreload.test.ts',
      'test/renderer/session/songBackground.test.ts',
    ],
    rules: {'llp/test-layer-imports': 'off'},
  },
];
