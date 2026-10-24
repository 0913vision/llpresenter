import 'pretendard/dist/web/variable/pretendardvariable.css';
import '@renderer/styles/tokens.css';
import './output.css';
import {startOutput} from './startOutput';

const SCREEN_PARAMETER = 'screen';

const root = document.getElementById('root');
const screenId = new URLSearchParams(window.location.search).get(
  SCREEN_PARAMETER,
);
const api = window.llp;
if (root !== null && screenId !== null && api !== undefined) {
  startOutput({root, api, screenId});
}
