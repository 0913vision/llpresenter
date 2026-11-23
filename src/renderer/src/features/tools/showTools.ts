/**
 * The 진행 도구 tabs, in the order of spec 04. `scrolls` says that a tab
 * scrolls as a whole; the others have a list in them that scrolls.
 */
export const SHOW_TOOLS = [
  {value: 'audio', label: '오디오', scrolls: false},
  {value: 'stage', label: '무대', scrolls: true},
  {value: 'timer', label: '타이머', scrolls: false},
  {value: 'message', label: '메시지', scrolls: true},
  {value: 'prop', label: '그래픽', scrolls: true},
  {value: 'macro', label: '매크로', scrolls: false},
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  scrolls: boolean;
}>;

export type ShowToolEntry = (typeof SHOW_TOOLS)[number];
export type ShowTool = ShowToolEntry['value'];

const STAGE_TOOL: ShowToolEntry & {value: 'stage'} = SHOW_TOOLS[1];

/** The tab with the value, or 무대 when there is none. */
export function showTool(value: string): ShowToolEntry {
  return SHOW_TOOLS.find(tab => tab.value === value) ?? STAGE_TOOL;
}
