# Toolbar

메뉴줄 아래 56px 줄입니다. 왼쪽에 작업 공간 탭과 미디어, 가운데에 검색 칸, 오른쪽에 Look과 세 화면의 출력 버튼을 둡니다. 좁은 창에서는 40px 줄이 됩니다.

## 쓰는 곳

- 주 창의 메뉴줄 바로 아래. 진행, 준비, 화면 설정 모든 작업 공간에서 같은 자리와 같은 버튼.

## 쓰지 않는 곳

- 패널 머리글의 도구: 패널 머리글 오른쪽의 IconButton과 sm Button.
- 보조 창(환경설정)과 대화상자: 툴바를 두지 않습니다.
- 작업 공간마다 버튼을 더하거나 빼지 않습니다. 화면 출력과 Look은 어느 작업 공간에서나 같은 자리에 있어야 합니다.

## 구성

- 줄: 높이 `size-toolbar`(56px), 바탕 `bg-app`, 좌우 `space-4`, 항목 사이 `space-6`. 버튼은 ToolbarButton(48)이고 세로 가운데.
- 왼쪽: 작업 공간 탭(진행, 준비, 화면 설정), 구분선, 미디어.
- 가운데: 남은 너비를 차지하는 칸 가운데에 검색 칸. 검색 칸은 TextField md(`ll-field ll-field--ring`, `size-control-md` 30, `bg-well`, 돋보기 16 `text-3`, 사이 `space-8`), 너비 420, 자리가 모자라면 줄어듭니다. 플레이스홀더 "곡, 가사, 초성".
- 오른쪽: Look(평상시), 구분선, 화면 출력 셋(본 화면, 무대, 방송 자막).
- 구분선: 1×24, `line`, 좌우 `space-8`(항목 사이 틈과 합쳐 14).
- 좁은 창: 높이 `size-toolbar-compact`(40px), 버튼은 ToolbarButton 좁은 형태(32), 미디어는 아이콘만, 검색 칸 너비 280(md 그대로), 구분선 좌우 `space-4`.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 보통 | `size-toolbar` 56 | 버튼 `toolbar-label`, 검색 `body` | 창 너비 1600 이상 |
| 좁은 창 | `size-toolbar-compact` 40 | 버튼 `label`, 검색 `body` | 창 너비 1280–1599(1366×768 등) |

두 형태를 가르는 창 너비는 Layout(창 크기와 배치)을 따릅니다.

## 상태

툴바 자체에는 상태가 없습니다. 각 버튼의 상태는 ToolbarButton, 검색 칸은 TextField를 따릅니다.

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 기본 | `bg-app` | | 아래 선 없음 |
| 검색 칸 포커스 | 칸 `bg-well` | | `ring-field-focus` |
| 대화상자가 열림 | `scrim`이 툴바까지 덮음 | | 메뉴줄은 덮지 않습니다 |

## 동작

- 포커스 순서: 작업 공간 탭(고른 탭 하나) → 미디어 → 검색 칸 → Look → 본 화면 → 무대 → 방송 자막.
- 검색 칸: 글자를 지우는 단추와 Esc 동작은 TextField를 따릅니다. 결과를 보일 자리는 이 컴포넌트가 정하지 않습니다.
- 툴바는 `role="toolbar"`를 쓰지 않습니다. 탭 묶음(`tablist`)과 출력 묶음(`group`)이 섞여 있어 각 묶음의 키보드 규칙을 따릅니다.
- 창이 좁아지면 검색 칸이 먼저 줄어듭니다(최소 너비 없음). 버튼 이름은 줄이지 않습니다. 그래도 모자라면 좁은 창 형태로 바꿉니다.

## 글쓰기

- 툴바에는 설명 문구를 두지 않습니다. 버튼 이름과 툴팁만 씁니다.
- 검색 칸의 플레이스홀더는 찾을 수 있는 것을 쉼표로 늘어놓습니다: "곡, 가사, 초성". "검색어를 입력하세요"처럼 쓰지 않습니다.

## 구현 메모

```jsx
<Toolbar compact={narrow}>
  <Toolbar.Group role="tablist" aria-label="작업 공간">…ToolbarTab×3</Toolbar.Group>
  <Toolbar.Divider />
  <ToolbarButton icon="film" label="미디어" pressed={binOpen} />
  <Toolbar.Center><TextField className="ll-toolbar__search" ring icon="search" placeholder="곡, 가사, 초성" aria-label="검색" /></Toolbar.Center>
  <ToolbarButton icon="layers" label="평상시" menu />
  <Toolbar.Divider />
  <Toolbar.Group role="group" aria-label="화면 출력">…OutputToggle×3</Toolbar.Group>
</Toolbar>
```

- 클래스: 줄 `ll-toolbar`, 좁은 창 `ll-toolbar--compact`, 묶음 `ll-toolbar__group`, 가운데 칸 `ll-toolbar__center`, 구분선 `ll-toolbar__divider`, 검색 칸 너비 `ll-toolbar__search`(`ll-field ll-field--ring`에 더함).

## 시안과 달라진 점

- 모든 보드(assemble.js `toolbar()`): 검색 칸 420×32, 바탕 #1c1c1c, 모서리 5, 돋보기 14, 좌우 12 → 420×30(md), `bg-well` + `ring-field`, `radius-md`, 돋보기 16, 좌우 10.
- 모든 보드: 구분선 높이 32 → 24.
- Compact: 툴바 44 → 40. 검색 칸 바탕 #1c1c1c, 돋보기 14, 글자 12px → `bg-well` + `ring-field`, 돋보기 16, 글자 13px(md). 너비 280 그대로.
