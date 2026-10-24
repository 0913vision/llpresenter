# Panel

창의 기본 면입니다. 34px 머리글(탭이나 제목, 오른쪽 조작) 아래에 스크롤되는 몸통을 두고, 필요하면 32px 바닥 줄을 붙입니다. 예배 순서, 퀵 실행, 라이브러리, 슬라이드, 미디어, 미리보기, 진행 도구, 항목 설정이 모두 이 틀을 씁니다.

## 쓰는 곳

- 진행, 준비, 미디어 화면의 모든 칸
- 좁은 창(1366×768)도 같은 패널을 씁니다. 열 너비와 창 안 배치는 `Layout`을 따릅니다.

## 쓰지 않는 곳

- 떠 있는 면(메뉴, 팝오버, 대화상자, 알림): `Menu`, `Dialog`, `Notification`을 씁니다. 패널에는 그림자를 쓰지 않습니다.
- 대화상자 안에서 목록을 묶는 상자: `Dialog`의 목록 상자(`bg-inset`)를 씁니다.
- 패널 안의 줄 하나하나: `ListRow`를 씁니다.

## 구성

- 면 `ll-panel`: 바탕 `bg-panel`, 모서리 `radius-lg`(5px), 그림자 없음, 넘치는 것은 잘라 냅니다.
- 패널 사이 `ll-panels`(`--column`은 세로로 쌓기): 틈 `panel-gap`(4px). 창 왼쪽과 오른쪽 가장자리도 4px(`ll-panels--window`). 작업 영역 위아래, 즉 툴바와 상태 표시줄에 닿는 쪽에는 틈을 두지 않습니다(`Layout`). 틈으로 보이는 바탕은 `bg-app`입니다.
- 머리글 `ll-panel__header`: 높이 `size-panel-header`(34px, 아래 1px 선 포함), 왼쪽 `panel-inset`(14px), 오른쪽 `space-8`, 아래 1px `line`.
  - 탭 `ll-panel__tab`: `label-strong`(12/16/600). 켜진 탭은 `text`이고 머리글 선 바로 위에 2px `text` 밑줄을 긋습니다. 꺼진 탭은 `text-3`. 탭 사이 18px(토큰 없음, 요청함). 탭 안 개수 배지는 `StatusMarks`의 `ll-count`, 이름과 사이 `space-6`.
  - 개수 `ll-panel__meta`: 탭이나 제목 뒤 `space-10`, `label`(12/16) `text-3`, 숫자 고정폭. 예: 라이브러리 128, 배경 영상 7.
  - 제목 `ll-panel__title`: 곡 제목 `ll-panel__title-text`(`title` 13/18/600) + 위치나 개수 `ll-panel__meta`("2 / 9", "9장"). 사이 `space-10`, 글자 바닥선을 맞춥니다. 제목이 길면 말줄임.
  - 예배 고르기 `ll-panel__switch`: 예배 순서 탭 바로 뒤 `space-4`. 투명 sm 버튼으로 높이 `size-control-sm`(26px), 안쪽 왼쪽 `space-6` 오른쪽 `space-4`, `label`(12/16) `text-3`, 화살표 `down` 12px, 글자와 화살표 사이 `space-4`, 모서리 `radius-md`.
  - 오른쪽 조작 `ll-panel__actions`: 오른쪽 끝에 붙이고 컨트롤 사이 `space-8`. sm 컨트롤만 둡니다: `IconButton`(26×26), `Button` sm, `Select` sm.
- 도구 줄 `ll-panel__tools`: 머리글 아래 검색 칸이나 성경 구절 칸 한 줄. 안쪽 위 8 좌우 8 아래 6, 칸이 줄 너비를 채웁니다(`TextField` md).
- 몸통 `ll-panel__body`: 안쪽 `panel-inset`(14px), 남는 높이를 모두 쓰고 넘치면 몸통만 세로로 스크롤합니다. 목록 몸통 `ll-panel__body--list`는 위 `space-4` 아래 `space-8`, 좌우 0(줄이 14px을 가집니다). 여백 없는 몸통은 `--flush`. 스크롤 막대는 얇게 그리고 손잡이는 `line-strong`입니다.
- 바닥 줄 `ll-panel__footer`: 높이 32px(토큰 없음, 요청함), 좌우 14px, 위 1px `line`, `caption`(11/14) `text-3`. 개수와 용량은 왼쪽("7개 2.1GB"), 썸네일 크기 슬라이더(`Slider`의 `ll-slider-row`)는 오른쪽 `ll-panel__footer-end`.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 탭 머리글 | 34 | label-strong 12/16/600 | 예배 순서, 퀵 실행, 라이브러리, 미디어, 미리보기, 진행 도구 |
| 탭 + 예배 고르기 | 34 | 탭 label-strong, 고르기 label text-3 | 예배 순서 |
| 탭 + 개수 | 34 | label-strong + label text-3 | 라이브러리 128 |
| 제목 머리글 | 34 | title 13/18/600 + label text-3 | 슬라이드(만복의 근원 하나님 2 / 9), 예배 순서 항목(9장), 배경 영상 7 |
| 도구 줄 | 44 (8 + 30 + 6) | body 13/18 | 라이브러리 검색, 퀵 실행 성경 구절 |
| 몸통 | 남는 높이 | - | 목록(`--list`), 썸네일 격자(안쪽 14) |
| 바닥 줄 | 32 | caption 11/14 text-3 | 슬라이드, 미디어의 개수와 썸네일 크기 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 탭 켜짐 | 없음 | `text` | 아래 2px `text` 밑줄, `aria-selected="true"` |
| 탭 꺼짐 | 없음 | `text-3` | |
| 탭 마우스 올림 | 없음 | `text-2` | 밑줄 없음, 100ms |
| 탭 포커스 | 없음 | 그대로 | outline 2px `accent`, offset 1px |
| 탭 쓸 수 없음 | 없음 | `text-off` | hover 없음, 이유는 툴팁 |
| 예배 고르기 기본 | 투명 | `text-3` | |
| 예배 고르기 마우스 올림 | `bg-raised` | `text-3` | 100ms ease-out |
| 예배 고르기 누름, 열림 | `bg-control-hover` | `text` | `aria-expanded="true"` 동안 유지 |
| 예배 고르기 포커스 | 그대로 | 그대로 | outline 2px `accent`, offset 1px |
| 예배 고르기 쓸 수 없음 | 투명 | `text-off` | hover 없음 |

## 동작

- 탭: 탭 줄은 `role="tablist"`, 탭은 `role="tab"`과 `aria-selected`, 몸통은 `role="tabpanel"`과 `aria-labelledby`. 탭 줄 안에서는 좌우 화살표로 옮기면 바로 켜집니다. Tab 키는 켜진 탭 하나에만 멈춥니다.
- 예배 고르기: 누르거나 Enter, Space, 아래 화살표로 예배 순서 목록(`Menu`의 팝오버 목록)을 엽니다. 목록은 버튼 아래 4px, 왼쪽 가장자리를 버튼에 맞춰 엽니다. `aria-haspopup="menu"`, 열린 동안 `aria-expanded="true"`.
- 포커스 순서: 머리글(탭, 예배 고르기, 오른쪽 조작) → 도구 줄 → 몸통 → 바닥 줄.
- 패널은 `section`에 패널 이름을 `aria-label`로 줍니다. 탭이 하나뿐이면 그 탭 이름이 패널 이름입니다.
- 패널 사이 틈을 끌어 열 너비를 바꾸는 규칙은 `Layout`을 따릅니다.

## 글쓰기

- 탭과 패널 이름은 짧은 명사입니다: "예배 순서", "퀵 실행", "라이브러리", "미리보기", "표시 중". 동사나 설명을 붙이지 않습니다.
- 머리글의 개수는 숫자만 쓰고, 무엇을 세는지 분명하지 않을 때만 단위를 붙입니다: "128", "7", "9장".
- 위치는 "현재 / 전체"로 쓰고 빗금 앞뒤를 띄웁니다: "2 / 9".
- 머리글에 도움말 문구나 상태 설명을 쓰지 않습니다.

## 구현 메모

- `<Panel label="예배 순서" tabs={[{ id: 'order', label: '예배 순서' }]} switcher={<ServiceSwitch value="주일 예배" />} actions={<IconButton icon="plus" label="항목 추가" />}>…</Panel>`
- `<Panel title="만복의 근원 하나님" meta="2 / 9" actions={<Select size="sm" media={thumb} value="따뜻한 빛" />} footer={<SliderRow icon="grid" />}>`
- 부품: `<PanelTabs>`, `<PanelSwitch>`, `<PanelTools>`, `<PanelBody variant="list" | "grid" | "flush">`, `<PanelFooter>`.
- 클래스: `ll-panels`, `ll-panels--column`, `ll-panels--window`, `ll-panel`, `ll-panel__header`, `ll-panel__tabs`, `ll-panel__tab`, `ll-panel__title`, `ll-panel__title-text`, `ll-panel__meta`, `ll-panel__switch`, `ll-panel__actions`, `ll-panel__tools`, `ll-panel__body`, `ll-panel__body--list`, `ll-panel__body--flush`, `ll-panel__footer`, `ll-panel__footer-end`.
- 머리글 높이는 `box-sizing: border-box`로 1px 선까지 34px입니다.

## 시안과 달라진 점

- 모든 보드의 패널 머리글: 34px + 아래 1px 선(합 35) → 선 포함 34.
- ShowH 진행 도구 탭: 탭 사이 14 → 18, 머리글 오른쪽 여백 14 → 8, 꺼진 탭 굵기 500 → 600.
- Compact 모든 패널 머리글: 안쪽 왼쪽 12 오른쪽 6 → 14, 8. 진행 도구 탭 사이 12 → 18, 꺼진 탭 굵기 500 → 600. 예배 순서 머리글의 + 버튼과 접기 버튼 사이 0 → 8. 퀵 실행 도구 줄 안쪽 6 6 4 → 8 8 6.
- 예배 고르기 버튼(ShowH, PrepService, Reflow, ServiceSwitch, AddSongs, AddSongsQuick, Bible, ImportEdit, ImportSave, ImportText, NewService, ServiceImport, Problems의 예배 순서 머리글): 높이 24 → 26(sm).
