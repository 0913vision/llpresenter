import type {LayerDefinition} from '../layer';
import {itemOverlayLayer} from './itemOverlay';
import {messageLayer} from './message';
import {propsLayer} from './props';
import {stageInfoLayer} from './stageInfo';
import {stageMessageLayer} from './stageMessage';
import {testPatternLayer} from './testPattern';

/** Every layer over the slide, back to front as docs/spec/03-output.md says. */
export const renderLayers: readonly LayerDefinition[] = [
  itemOverlayLayer,
  propsLayer,
  messageLayer,
  stageInfoLayer,
  testPatternLayer,
  stageMessageLayer,
];
