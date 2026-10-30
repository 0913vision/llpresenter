/** The 진행 도구 tabs, in the order of spec 04. */
export const SHOW_TOOLS = [
  {value: 'showing', label: '표시 중'},
  {value: 'audio', label: '오디오'},
  {value: 'stage', label: '무대'},
  {value: 'timer', label: '타이머'},
  {value: 'message', label: '메시지'},
  {value: 'notice', label: '공지'},
  {value: 'prop', label: '소품'},
  {value: 'macro', label: '매크로'},
] as const satisfies ReadonlyArray<{value: string; label: string}>;

export type ShowToolEntry = (typeof SHOW_TOOLS)[number];
export type ShowTool = ShowToolEntry['value'];

export const AVAILABLE_TOOL_TABS = SHOW_TOOLS;
