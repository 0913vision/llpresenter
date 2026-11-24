import {THEME_CANVAS} from '@core/schema/screens/screens';
import type {ScreenChange} from '@core/screens';

/** The canvas size, as the 해상도 rows and position titles name it. */
export const CANVAS_SIZE = `${THEME_CANVAS.width} × ${THEME_CANVAS.height}`;

/** Applies one change to the 화면 the properties show. */
export type OnScreenChange = (change: ScreenChange) => void;
