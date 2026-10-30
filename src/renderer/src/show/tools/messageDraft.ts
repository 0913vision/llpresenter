import type {MessageTemplate} from '@core/schema/messages';
import type {Screen} from '@core/schema/screens';
import {MAX_TARGET_SCREENS} from '@core/schema/overlayState';
import {
  fillMessageText,
  messageBlankNames,
  MAX_MESSAGE_CHARACTERS,
} from '@core/overlays/messageText';

export type DraftTargets = Exclude<MessageTemplate['targets'], undefined>;

export function toggleMessageScreen(
  targets: DraftTargets,
  id: Screen['id'],
): DraftTargets {
  if (targets === 'all') return [id];
  return targets.includes(id)
    ? targets.filter(value => value !== id)
    : [...targets, id];
}

export function currentMessageTargets(
  targets: DraftTargets,
  screens: readonly Screen[],
): DraftTargets {
  if (targets === 'all') return targets;
  const ids = new Set(screens.map(screen => screen.id));
  return [...new Set(targets)].filter(id => ids.has(id));
}

export function prepareMessage({
  template,
  values,
  targets,
  screenCount,
}: {
  readonly template: MessageTemplate;
  readonly values: ReadonlyMap<string, string>;
  readonly targets: DraftTargets;
  readonly screenCount: number;
}) {
  if (template.text.length > MAX_MESSAGE_CHARACTERS) {
    return {reason: '메시지가 너무 깁니다', text: ''};
  }
  const blanks = messageBlankNames(template.text);
  if (blanks.some(name => (values.get(name) ?? '').trim() === '')) {
    return {reason: '빈칸을 채워야 보낼 수 있습니다', text: ''};
  }
  let text: string;
  try {
    text = fillMessageText(template, Object.fromEntries(values));
  } catch {
    return {reason: '메시지가 너무 깁니다', text: ''};
  }
  if (text.trim() === '') return {reason: '메시지 내용이 없습니다', text};
  const count = targets === 'all' ? screenCount : targets.length;
  if (count === 0) return {reason: '보낼 화면을 선택하세요', text};
  if (count > MAX_TARGET_SCREENS) {
    return {reason: '보낼 화면이 너무 많습니다', text};
  }
  return {reason: undefined, text};
}
