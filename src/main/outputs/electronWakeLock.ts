import {powerSaveBlocker} from 'electron';
import type {WakeLock} from './wakeLock';

/** A wake lock that keeps the display on, which keeps the system awake too. */
export function createElectronWakeLock(): WakeLock {
  return {
    acquire: () => {
      const id = powerSaveBlocker.start('prevent-display-sleep');
      return () => {
        if (powerSaveBlocker.isStarted(id)) powerSaveBlocker.stop(id);
      };
    },
  };
}
