import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@renderer/styles/tokens.css';
import './output.css';
import {showMonitorNumber} from './monitorNumber';
import {startOutput} from './startOutput';
import {startAudio} from './startAudio';

const SCREEN_PARAMETER = 'screen';
const MONITOR_NUMBER_PARAMETER = 'monitor-number';

const root = document.getElementById('root');
const parameters = new URLSearchParams(window.location.search);
const monitorNumber = parameters.get(MONITOR_NUMBER_PARAMETER);
const screenId = parameters.get(SCREEN_PARAMETER);
const audio = parameters.get('audio');
const api = window.llp;
if (root !== null && audio !== null && api !== undefined) {
  startAudio({root, api, muted: audio !== 'sound'});
} else if (root !== null && monitorNumber !== null) {
  showMonitorNumber(root, monitorNumber, parameters.get('monitor-details'));
} else if (root !== null && screenId !== null && api !== undefined) {
  startOutput({root, api, screenId});
}
