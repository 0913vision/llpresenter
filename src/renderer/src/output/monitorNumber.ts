import styles from './monitorNumber.module.css';
import {
  parseIdentification,
  type Identification,
} from '@shared/schema/identification';

const MONITOR_NUMBER = /^[1-9][0-9]?$/;

/**
 * Draws a monitor number with optional validated screen details. Invalid
 * numbers or malformed details draw nothing.
 *
 * @returns Whether a number was drawn.
 */
export function showMonitorNumber(
  root: HTMLElement,
  value: string,
  details: string | null = null,
): boolean {
  if (!MONITOR_NUMBER.test(value)) return false;
  if (details !== null) return showIdentification(root, value, details);
  const number = document.createElement('div');
  number.className = styles['number'] ?? '';
  number.textContent = value;
  root.replaceChildren(number);
  return true;
}

const METHODS: Readonly<Record<Identification['method'], string>> = {
  fullscreen: '전체 화면',
  window: '창',
  capture: '캡처 창',
  display: '시스템 디스플레이',
};

function showIdentification(
  root: HTMLElement,
  number: string,
  encoded: string,
): boolean {
  if (encoded.length > 2000) return false;
  let value: unknown;
  try {
    value = JSON.parse(encoded);
  } catch {
    return false;
  }
  const result = parseIdentification(value);
  if (!result.ok) return false;
  const details = result.value;
  const card = document.createElement('section');
  card.className = styles['identification'] ?? '';
  card.setAttribute('aria-label', '모니터 번호 표시');
  const kind =
    details.kind === null
      ? ''
      : details.kind === 'audience'
        ? '청중, '
        : '무대, ';
  const refresh =
    details.refreshRate === 0
      ? '주사율 미확인'
      : `${Number(details.refreshRate.toFixed(2))} Hz`;
  for (const [tag, text] of [
    ['strong', number],
    ['h1', details.name],
    ['p', `${details.width} × ${details.height}, ${refresh}`],
    [
      'p',
      `${kind}${METHODS[details.method]}${details.method === 'display' ? '' : ' (시스템)'}`,
    ],
  ]) {
    const element = document.createElement(tag ?? 'p');
    element.textContent = text ?? '';
    card.append(element);
  }
  root.replaceChildren(card);
  return true;
}
