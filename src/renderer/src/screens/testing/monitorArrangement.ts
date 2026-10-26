import type {MonitorList} from '@shared/schema/monitors';
import {MAIN_ID} from './documents';

/** The two-monitor geometry from the M3-C3-8 live check. */
export const wideMonitorArrangement: MonitorList = [
  {
    id: 1,
    number: 1,
    name: 'Wide monitor',
    bounds: {x: 0, y: 0, width: 3440, height: 1440},
    scaleFactor: 1,
    refreshRate: 144,
    hasMainWindow: true,
    screenIds: [],
  },
  {
    id: 2,
    number: 2,
    name: 'Second monitor',
    bounds: {x: 3440, y: 222, width: 1920, height: 1080},
    scaleFactor: 1,
    refreshRate: 60,
    hasMainWindow: false,
    screenIds: [MAIN_ID],
  },
];
