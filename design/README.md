# design

UI 시안과 디자인 시스템의 원본입니다. 둘 다 사용자 계정의 claude.ai 아티팩트로도 게시되어 있습니다.

| 폴더 | 내용 | 게시본 |
| --- | --- | --- |
| `system/` | 디자인 시스템: 원칙, 토큰, 컴포넌트 30개의 문서와 미리보기 | [디자인 시스템](https://claude.ai/artifact/LDSJg1gwuFymJBuTbVEBQP) |
| `drafts/` | 시안 보드 27개와 보고 페이지, 그 보드를 만드는 스크립트 | [시안](https://claude.ai/artifact/4Z4M7wLUjyxs5iqLzkeXct) |

구현의 기준은 `system/project/`입니다. 시안 보드와 다르면 디자인 시스템이 이깁니다.

## system/

- `project/README.md`: 원칙, 색, 글자, 간격, 아이콘, 상태와 움직임, 창 크기와 배치, 글쓰기와 용어집
- `project/tokens.json`, `project/tokens.css`: 토큰. 앱은 `tokens.css`를 그대로 씁니다
- `project/components/<이름>/README.md`: 컴포넌트 문서. `preview.html`은 모든 상태를 보여 주는 미리보기입니다
- `project/components/bundle.css`: 미리보기용 CSS(`css/` 조각을 `build-css.js`로 합친 것). 앱 컴포넌트를 만들 때 값의 참고로 씁니다
- `upload/Icons/`: 아이콘 86개(Phosphor Regular). 이름표는 `project/assets/Icons/README.md`
- `upload/Media/`: 견본 배경 그림 4장
- 미리보기를 로컬에서 보기: `design/system`에서 `node card-server.js`(5299번 포트)를 띄운 뒤 `D:/programming/2020-/pp/node_modules/electron/dist/electron.exe shoot-card.js <컴포넌트> 960` → `shots/<컴포넌트>.png`
- 토큰을 고치면 `node gen-tokens-css.js`로 `tokens.css`를 다시 만듭니다
- `CONVENTIONS.md`, `BOARD-CHANGES.md`: 디자인 시스템을 만들 때 쓴 작업 규칙과 보드 수정 목록(기록)

## drafts/

- `llp-design/project/*.dc.html`: 보드(1920×1080), `Main.dc.html`은 보고 페이지, `canvas.json`은 보드 배치
- `llp-render/`: 보드 원본(`src/`, `parts/`)과 만드는 스크립트
  - `assemble.js`: `src/<보드>.html`에 공통 머리, 메뉴줄, 툴바, 상태 표시줄을 넣어 `.dc.html`을 만듭니다
  - 생성 순서: `node build-scene.js` → `node make-fork-a.js` → `node build-import-edit.js` → `node assemble.js <보드>.html ...`
  - `ShowH.dc.html`은 원본 없이 직접 고친 보드입니다
  - 보드 보기: `node server.js 5199`를 띄운 뒤 `electron shoot.js <보드>.dc.html shots 0.5`
- `llp-render/one-off/`: 예전 상태를 기준으로 짠 일회용 스크립트입니다. 실행하지 않습니다
