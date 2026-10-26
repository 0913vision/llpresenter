import type {MonitorInfo} from '@shared/schema/monitors';
import {MAIN_ID} from './documents';

export const projector: MonitorInfo = {
  id: 2,
  number: 3,
  name: 'Projector',
  bounds: {x: 1920, y: -1080, width: 1920, height: 1080},
  scaleFactor: 1.5,
  refreshRate: 60,
  hasMainWindow: false,
  screenIds: [MAIN_ID],
};
