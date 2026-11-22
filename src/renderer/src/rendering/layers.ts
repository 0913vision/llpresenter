import type {LayerDefinition} from './layer';
import {itemOverlayLayer} from './layers/itemOverlay';
import {messageLayer} from './layers/message';
import {propsLayer} from './layers/props';
import {stageInfoLayer} from './layers/stageInfo';
import {stageMessageLayer} from './layers/stageMessage';
import {testPatternLayer} from './layers/testPattern';

/** Every layer over the slide, back to front as docs/spec/03-output.md says. */
export const renderLayers: readonly LayerDefinition[] = [
  itemOverlayLayer,
  propsLayer,
  messageLayer,
  stageInfoLayer,
  testPatternLayer,
  stageMessageLayer,
];
