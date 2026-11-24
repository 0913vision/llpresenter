import {join} from 'node:path';

// NOTE(0913vision): The app archive includes the icon beside out/main.
/** The icon file of the windows, as it lies in the app archive. */
export const appIconPath = join(__dirname, '../../build/icon.ico');
