import styles from './monitorNumber.module.css';

const MONITOR_NUMBER = /^[1-9][0-9]?$/;

/**
 * Draws one monitor's number for 모니터 번호 표시. Anything but a number from
 * 1 to 99 draws nothing.
 *
 * @returns Whether a number was drawn.
 */
export function showMonitorNumber(root: HTMLElement, value: string): boolean {
  if (!MONITOR_NUMBER.test(value)) return false;
  const number = document.createElement('div');
  number.className = styles['number'] ?? '';
  number.textContent = value;
  root.replaceChildren(number);
  return true;
}
