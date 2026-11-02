import {
  parseBackUpNowRequest,
  parseBackUpNowResult,
  parseChooseLocationRequest,
  parseChooseLocationResult,
  parseLocationsView,
  refuseBackUpNow,
  refuseChooseLocation,
  type BackUpNowResult,
  type ChooseLocationRequest,
  type ChooseLocationResult,
  type LocationsView,
} from '@core/schema/libraryLocations';
import {push, query, request, type IpcPort} from './endpoint';

/** The calls behind the 라이브러리 위치 and 백업 rows of 환경설정. */
export const locationsEndpoints = {
  get: query<LocationsView>('locations:get', parseLocationsView),
  changed: push<LocationsView>('locations:changed', parseLocationsView),
  choose: request<ChooseLocationRequest, ChooseLocationResult>(
    'locations:choose',
    {
      request: parseChooseLocationRequest,
      reply: parseChooseLocationResult,
      refuse: refuseChooseLocation,
    },
  ),
  backUpNow: request<null, BackUpNowResult>('locations:back-up-now', {
    request: parseBackUpNowRequest,
    reply: parseBackUpNowResult,
    refuse: refuseBackUpNow,
  }),
};

/** The 위치 and 백업 part of `window.llp`. */
export function locationsApi(port: IpcPort) {
  const backUpNow = port.request(locationsEndpoints.backUpNow);
  return {
    /** Reads the folders, the last backup, and whether a backup runs. */
    get: port.query(locationsEndpoints.get),
    /** Follows every change of what `get` reads. */
    subscribe: port.subscribe(locationsEndpoints.changed),
    /**
     * Opens the system folder dialog and stores the chosen folder; a folder
     * that can't be written is refused and nothing is stored.
     */
    choose: port.request(locationsEndpoints.choose),
    /** Runs one backup now, unless an output is on or one already runs. */
    backUpNow: (): Promise<BackUpNowResult> => backUpNow(null),
  };
}

export type LocationsApi = ReturnType<typeof locationsApi>;
