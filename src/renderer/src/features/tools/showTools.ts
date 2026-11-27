/**
 * The 진행 도구 tabs, in the order of spec 04. `scrolls` says that a tab
 * scrolls as a whole; the others have a list in them that scrolls.
 */
export const SHOW_TOOLS = [
  {value: 'message', label: '메시지', scrolls: true},
  {value: 'timer', label: '타이머', scrolls: false},
  {value: 'audio', label: '오디오', scrolls: false},
  {value: 'prop', label: '그래픽', scrolls: true},
  {value: 'macro', label: '매크로', scrolls: false},
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  scrolls: boolean;
}>;

/** One tab of the 진행 tools, with its name. */
export type ShowToolEntry = (typeof SHOW_TOOLS)[number];
/** The value of one tab of the 진행 tools. */
export type ShowTool = ShowToolEntry['value'];

const FIRST_TOOL: ShowToolEntry = SHOW_TOOLS[0];

/** The tab with the value, or the first one, 메시지, when there is none. */
export function showTool(value: string): ShowToolEntry {
  return SHOW_TOOLS.find(tab => tab.value === value) ?? FIRST_TOOL;
}
