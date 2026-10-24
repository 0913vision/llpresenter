# 전달 문서: devops

- 세션 이름: devops
- 브랜치: `rewrite/devops` (자기 worktree)
- 개발 서버 포트: 5185, 앱 데이터 폴더: `D:\llp-dev\devops`
- 단계: 1단계(팀장의 기반 작업과 동시에)

## 목표

모든 팀원과 팀장이 같은 검사 하나로 품질을 확인하게 합니다. 이 프로젝트는 예배 중에 멈추면 안 되므로, 런타임 오류를 미리 막는 규칙과 빠르고 믿을 수 있는 시험 환경이 핵심입니다. `docs/TECH.md`의 "품질 기준"을 도구로 지키게 만드는 일입니다.

## 할 일

1. `npm run verify`: 타입 검사, lint, 단위 시험(시험 범위 보고 포함), 빌드를 차례로 돌리고 하나라도 실패하면 실패로 끝납니다. Windows의 Git Bash와 PowerShell 어디서 돌려도 같게 동작해야 합니다.
2. lint 설정(flat config): `any`, 검사를 피하는 타입 단언, `!` 금지, 처리하지 않은 Promise 금지, exhaustive switch, React hooks 규칙, 쓰지 않는 변수 금지. 규칙마다 왜 넣었는지 한 줄 주석.
3. Vitest: 초반 틀에 최소 설정(`vitest.config.mts`)과 시험 파일 다섯 개가 이미 있습니다. 이를 넓힙니다: 시험 범위(coverage) 보고, 임시 폴더 만들기와 지우기, 가짜 시계 같은 도우미, 메인 프로세스 코드와 화면 코드를 따로 돌리는 설정. 전체 단위 시험이 1분 안에 끝나게 합니다.
4. GitHub Actions 설정(`.github/workflows/ci.yml`): rewrite에 push될 때와 손으로 돌릴 때(workflow_dispatch) Windows 실행기에서 `npm ci`, `npm run verify`. Electron 내려받기 캐시. push는 팀장이 합친 뒤에 하므로, 팀원인 devops는 push하지 않습니다.
5. 오래 돌리기 스크립트의 틀(`scripts/soak/`): 앱을 시험 모드로 띄워 60분 동안 돌리고, 앱이 남기는 측정 기록(프로세스별 메모리, 출력 창 fps)을 모아 판정합니다(60분 동안 계속 늘면 실패). 측정 기록의 형식은 제안으로 리뷰 문서에 적고, 앱 쪽 기록 기능은 2단계에서 팀장이 만듭니다.
6. 사용법을 `scripts/README.md`에 짧게 적습니다.

## 하지 않을 일

- `src/` 안의 앱 코드를 고치지 않습니다. 초반 틀의 코드가 새 lint 규칙에 걸리면 고치지 말고 그 목록을 리뷰 문서에 적어 팀장에게 넘깁니다(자기 코드는 자기가 고친다는 팀 규칙에 따라 팀장이 고칩니다). 그동안은 그 줄만 lint 제외로 두고 제외 목록을 리뷰 문서에 적습니다.
- `tsconfig*.json`은 팀장 소유입니다. 엄격한 옵션(`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` 등)은 초반 틀에서 이미 켰습니다.
- push하지 않습니다.

## 소유 파일

- `.github/`, `scripts/`, lint 설정 파일, `vitest.config.mts`, 시험 도우미 폴더(제안: `test/`)
- `package.json`의 `scripts`와 `devDependencies`(이 묶음만 예외로 허락합니다. `dependencies`와 다른 칸은 건드리지 않습니다)
- `package-lock.json`(위 변경에 따른 것만)

## 허락된 의존성 (개발용만)

- `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `vitest`, `@vitest/coverage-v8`
- 그 밖에 필요하면 리뷰 문서에 이유를 적고 팀장에게 먼저 묻습니다.
- 버전은 `^` 없이 정확히 고정합니다.
- 주의: 이 저장소는 TypeScript 7(Go로 다시 만든 판)을 씁니다. `typescript-eslint`의 타입 기반 규칙이 TypeScript 7에서 도는지 먼저 확인하고, 안 되면 대안(예: lint용으로만 TypeScript 6을 따로 두기)을 리뷰 문서에 적어 팀장 결정을 받습니다.

## 읽을 것

- `CLAUDE.md`, `docs/WORKFLOW.md`, `docs/TECH.md`(품질 기준, 확인하는 방법)

## 완료 기준

- 깨끗한 클론에서 `npm ci` 다음 `npm run verify`가 통과합니다.
- 일부러 넣은 위반(예: `any`, `!`, 처리하지 않은 Promise)을 lint가 잡는 것을 확인하고 결과를 리뷰 문서에 적습니다(위반은 지우고 커밋합니다).
- 단위 시험 전체가 1분 안에 끝납니다.

## 마치면

`docs/briefs/_template.md`의 "마치면" 순서대로 합니다.
