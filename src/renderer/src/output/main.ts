import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@renderer/styles/tokens.css';
import './output.css';
import {showMonitorNumber} from './monitorNumber';
import {startOutput} from './startOutput';

const SCREEN_PARAMETER = 'screen';
const MONITOR_NUMBER_PARAMETER = 'monitor-number';

const root = document.getElementById('root');
const parameters = new URLSearchParams(window.location.search);
const monitorNumber = parameters.get(MONITOR_NUMBER_PARAMETER);
const screenId = parameters.get(SCREEN_PARAMETER);
const api = window.llp;
if (root !== null && monitorNumber !== null) {
  showMonitorNumber(root, monitorNumber);
} else if (root !== null && screenId !== null && api !== undefined) {
  startOutput({root, api, screenId});
}
