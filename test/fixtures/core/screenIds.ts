import {createScreenId, type ScreenId} from '@core/schema/ids';
import {STARTER_SCREEN_IDS} from '@core/screens/screens';

/** The starter 청중 화면 as a screen id, the only key of its output. */
export const MAIN_SCREEN: ScreenId = createScreenId(STARTER_SCREEN_IDS.main);
/** The starter 방송 화면 as a screen id. */
export const BROADCAST_SCREEN: ScreenId = createScreenId(
  STARTER_SCREEN_IDS.broadcast,
);
/** The starter 무대 화면 as a screen id. */
export const STAGE_SCREEN: ScreenId = createScreenId(STARTER_SCREEN_IDS.stage);
/** A screen id that the fixture slice of the registry tests turns on. */
export const FIXTURE_LOADED_SCREEN: ScreenId = createScreenId(
  '00000000-0000-4000-8000-0000000000f1',
);
