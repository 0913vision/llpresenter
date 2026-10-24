# MenuBar

창 맨 위의 30px 줄입니다. 앱 이름, 메뉴, 가운데 예배 이름, 창 조절 버튼을 담고 창 제목줄을 겸합니다(테두리 없는 Electron 창).

## 쓰는 곳

- 주 창의 맨 위, 모든 작업 공간에서 같은 모양.
- 환경설정 같은 보조 창의 제목줄(메뉴 없이 창 이름과 닫기만).

## 쓰지 않는 곳

- 툴바(작업 공간 탭, 검색, 출력): Toolbar.
- 메뉴를 펼친 목록 자체: Menu. 메뉴줄은 펼칠 자리만 정합니다.
- 대화상자 머리글: Dialog. 대화상자는 창이 아니라 메뉴줄 아래에 뜹니다.

## 구성

- 줄: 높이 `size-menubar`(30px), 바탕 `bg-app`, 왼쪽 `space-12`. 아래 선은 없습니다(툴바와 같은 바탕으로 이어짐).
- 앱 이름 "LoveLight": 12px 700(`band`와 같은 값), 자간 −0.01em, `text`, 오른쪽 `space-14`.
- 메뉴 항목: 파일, 편집, 보기, 출력, 창, 도움말. 높이 24px, 좌우 9px, 모서리 `radius-sm`, 글자 `label`(12/16) `text-2`, 항목 사이 틈 없음.
- 가운데 제목: 지금 예배 이름(주일 예배). 창 너비의 가운데, 글자 `label` `text-3`. 메뉴나 창 조절 버튼과 겹치지 않게 최대 너비 36%이고 넘치면 말줄임.
- 창 조절 버튼: 최소화 `min`, 최대화 `max`, 닫기 `x`. 46×30, 아이콘 `size-icon-14` `text-2`, 모서리 없음, 오른쪽 끝에 붙임.
- 보조 창 제목줄: 같은 30px 줄, 왼쪽 `space-14`에 창 이름 `label-strong` `text`, 오른쪽에 닫기 하나.

## 크기와 변형

| 이름 | 높이 | 글자 | 쓰는 곳 |
| --- | --- | --- | --- |
| 주 창 메뉴줄 | `size-menubar` 30 | 메뉴 `label`, 제목 `label` | 주 창 |
| 메뉴 항목 | 24 | `label` `text-2` | 메뉴줄 안 |
| 창 조절 버튼 | 46×30 | 아이콘 14 | 메뉴줄 오른쪽 끝 |
| 보조 창 제목줄 | 30 | 창 이름 `label-strong` | 환경설정 |

## 상태

| 상태 | 바탕 | 글자/아이콘 | 그 밖 |
| --- | --- | --- | --- |
| 메뉴 항목 기본 | 없음 | `text-2` | |
| 메뉴 항목 마우스 올림 | `bg-raised` | `text-2` | 100ms ease-out |
| 메뉴 항목 누름, 메뉴 열림(`aria-expanded`) | `bg-control-hover` | `text` | 메뉴가 열려 있는 동안 유지 |
| 창 조절 기본 | 없음 | `text-2` | |
| 창 조절 마우스 올림 | `bg-raised` | `text-2` | 닫기도 같습니다(빨강 hover 없음) |
| 창 조절 누름 | `bg-control-hover` | `text` | |
| 포커스 | 그대로 | 그대로 | 메뉴 항목은 offset 1px, 창 조절 버튼은 창 가장자리에서 잘리지 않게 안쪽(offset −2px) |

## 동작

- 줄 전체가 창을 끄는 자리입니다(`-webkit-app-region: drag`). 메뉴와 창 조절 버튼만 `no-drag`. 빈 곳을 두 번 누르면 최대화와 되돌리기를 오갑니다(Windows 기본 동작).
- 메뉴: 줄은 `role="menubar"`, 항목은 `role="menuitem"` + `aria-haspopup="menu"` + `aria-expanded`. 누르면 메뉴를 항목 아래 왼쪽 끝에 맞춰 엽니다. 메뉴 하나가 열려 있을 때 다른 항목에 마우스를 올리면 그 메뉴로 바뀝니다.
- 키보드: Alt 또는 F10으로 첫 항목에 포커스, 왼쪽/오른쪽 화살표로 옮김, Enter, Space, 아래 화살표로 열기, Esc로 닫고 메뉴줄에서 나옵니다. Alt + 밑줄 글자 접근 키는 두지 않습니다.
- 창 조절 버튼은 `aria-label`(최소화, 최대화, 닫기)과 같은 이름의 툴팁을 줍니다. 최대화된 창에서는 이름을 "이전 크기로 복원"으로 바꿉니다(두 겹 사각형 아이콘은 아직 아이콘 목록에 없습니다).
- 가운데 제목은 누를 수 없습니다. 예배를 바꾸는 일은 예배 순서 패널 머리글에서 합니다.

## 글쓰기

- 메뉴 이름은 두세 글자의 명사로 고정합니다: 파일, 편집, 보기, 출력, 창, 도움말.
- 가운데 제목에는 예배 이름만 씁니다(주일 예배). 앱 이름, 파일 경로, "저장 안 됨" 표시를 붙이지 않습니다. 저장 상태는 StatusBar가 보입니다.

## 구현 메모

```jsx
<MenuBar title={service.name} menus={['파일', '편집', '보기', '출력', '창', '도움말']} />
<MenuBar variant="window" title="환경설정" />
```

- 창 조절은 Electron `BrowserWindow`의 minimize, maximize/unmaximize, close를 부릅니다. 메뉴 내용은 Menu 컴포넌트로 그리고 Electron 기본 메뉴는 쓰지 않습니다.
- 클래스: 줄 `ll-menubar`, 보조 창 `ll-menubar--window`, 앱 이름 `ll-menubar__brand`, 메뉴 묶음 `ll-menubar__menus`, 항목 `ll-menubar__item`, 제목 `ll-menubar__title`, 창 이름 `ll-menubar__name`, 창 조절 묶음 `ll-menubar__controls`, 버튼 `ll-menubar__win`.

## 시안과 달라진 점

- 모든 보드(assemble.js `menubar`): 메뉴줄 바탕 #0b0b0b → `bg-app`(#0e0e0e).
- Prefs, Shortcuts: 보조 창 제목줄 높이 32 → 30, 바탕 #0b0b0b → `bg-app`, 닫기 46×32 → 46×30.
