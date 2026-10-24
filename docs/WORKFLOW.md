# Workflow

We work as a team. The lead session is the team lead, and the work sessions are
team members. Each team member works in their own git worktree and branch, and
when the work is done, sends the lead a review request (PR). Both the lead and
the reviewer must approve, and only rebased branches are merged into the
integration branch, by fast-forward only.

The integration branch is `rewrite`. For now, it acts as the team's main branch
(`main` holds the 2024 code). When v1 is done, we fast-forward `main` to
`rewrite`.

## Roles

| Who                        | Responsibilities                                                                                                                                                                                                                                  | Doesn't                                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| User                       | Starting and ending phases, decisions that aren't in the plan, ruling on what the lead and the reviewer can't agree on                                                                                                                            |                                                                                    |
| Lead                       | Maintaining `docs/PLAN.md` and `docs/STATUS.md`, changing the shared contracts and shared files, starting team member sessions, writing briefs, reviewing, calling the reviewer, merging after approval, integration tests, reporting to the user | Change a team member's owned files, or resolve conflicts on a team member's behalf |
| Team member (work session) | Implementing the scope of the brief, rebasing their branch onto the latest `rewrite` and resolving conflicts themselves, writing review requests, addressing review comments, asking questions                                                    | Change shared files, touch other branches, or commit directly to `rewrite`         |
| Reviewer                   | Only reads review requests, reviews them independently, and gives an approval or a change request                                                                                                                                                 | Change code                                                                        |

Until Codex joins, the reviewer is a read-only review agent that the lead starts
with a fresh context for each review request. After Codex joins, Codex (running
read-only) takes this role.

## Starting sessions

- The session that handled phase 0 ("프로프리젠터 프로젝트 찾기", Find the
  ProPresenter project) continues as the lead. If that session ends or its
  context grows too long, a new session takes over as the lead with
  `docs/briefs/lead.md`.
- The lead runs in `D:\programming\2020-\pp` (`rewrite`) with permission prompts
  turned off. Team members start in the same mode. If the modes differ, messages
  between sessions stall while they wait for the user's approval.
- The lead starts team members with the session start tool: a fresh context,
  their own worktree, the branch `rewrite/<name>`, and running locally.
- The lead can start a new session right away only in a turn that a user message
  started. In a turn woken by a team member's completion notice, the lead can
  only offer a suggestion card, so the next bundle starts when the user says to
  start or clicks the card.
- Before you start a session, commit its brief to `rewrite`. The worktree starts
  from the last commit on `rewrite`.
- At most three team members run at the same time.

## Review request (PR) flow

1. **Implement:** The team member implements the scope of the brief and commits
   in meaningful units. Keep each change small and focused, following Google's
   engineering practices. Each commit message is one line in the format and with
   the tags that `CLAUDE.md` defines. Run `npm run format` before you commit.
2. **Rebase:** Before you send the review request, run `git rebase rewrite` in
   your own worktree to move your branch onto the latest `rewrite`. The team
   member resolves conflicts. A conflict in a shared file means that the team
   member changed a shared file, so drop that change and send it to the lead as
   a request instead.
3. **Check:** Run the checks that `CLAUDE.md` lists (now `npm run typecheck`,
   `npm test`, and `npm run format:check`; from phase 1 on, `npm run verify`)
   and the UI tests that the brief lists, and record the results. If anything
   fails, don't send the review request.
4. **Request a review:** Write `docs/reviews/<name>-<number>.md` from
   `docs/reviews/_template.md` and commit it. It says what changed and why, the
   check results, the decisions you made yourself, and where you want the
   reviewers to look. Then send the lead this message with SendMessage, and
   wait:

   ```text
   Review request: docs/reviews/<name>-<number>.md, branch rewrite/<name>, commit <hash>
   ```

5. **Review:** The lead looks at `git diff rewrite...rewrite/<name>` and at the
   actual behavior. At the same time, the lead calls the reviewer to review the
   same range separately. Both reviewers follow Google's engineering practices:
   approve a change once it improves the overall health of the code, even if it
   isn't perfect. They check the clean code rules and the comment rules in
   `CLAUDE.md` and request changes when a rule is broken, and they don't approve
   changes without tests. Both write their results in their review section of
   that review document and state clearly "Approve" or "Request changes."
6. **Address comments:** If changes are requested, the lead tells the team
   member with SendMessage. For each comment, the team member either addresses
   it or replies in the review document with the reason for not addressing it,
   adds new commits, and then starts again from step 2.
7. **Approve and merge:** When both the lead and the reviewer approve, the lead
   confirms that the team member's branch sits on the latest `rewrite` and
   merges it by fast-forward only: `git merge --ff-only rewrite/<name>`. If
   `rewrite` moved in the meantime, the lead asks the team member to rebase
   again. If a conflict in that rebase changed code, the branch gets reviewed
   again. If the branch only moved up without conflicts, it doesn't.
8. **Clean up:** The lead updates `docs/STATUS.md`, commits it, and tells the
   other team members who are still working that `rewrite` changed. Finished
   worktrees and branches are cleaned up after the user confirms.

- Merges are fast-forward only. Don't create merge commits or squash merges.
- Never rebase or revert `rewrite` itself.
- After a merge, the lead pushes `rewrite` to `origin` (for backup and CI).
  Nobody force-pushes. Team members don't push.
- If the lead and the reviewer disagree, they write their reasons in the review
  document and discuss it once more. If they still can't agree, the user
  decides.

## Questions

- Team members can ask the lead with SendMessage at any time. Don't guess about
  shared contracts (shared types, commands, schemas, tokens), scope, or gaps in
  the spec. Ask.
- What the lead can't answer (product decisions) goes to the user. The lead
  records the answer in `docs/decisions.md` and then passes it on to the team
  member.
- When a team member finishes a turn, the app notifies the lead automatically.
  The lead then checks the message and the review document. The lead doesn't
  rely on the report alone, and looks at the actual changes and test results.
- The lead's instructions and answers also go by SendMessage (to that session's
  `local_...` ID).

## Documents

Write every document in English, following the style guides in `CLAUDE.md`.

| File                              | Who                                                                              | Contents                                                                |
| --------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `docs/briefs/<name>.md`           | Lead                                                                             | Brief. Template: `docs/briefs/_template.md`                             |
| `docs/reviews/<name>-<number>.md` | The team member writes it; the lead and the reviewer fill in the review sections | Review request and reviews. Template: `docs/reviews/_template.md`       |
| `docs/STATUS.md`                  | Lead                                                                             | State of the phases, bundles, and review requests                       |
| `docs/decisions.md`               | Lead                                                                             | New decisions made during implementation, one entry each, with the date |

## When to clear

Principle: clear a session only when everything the next person needs to know is
in files. The commits are done, the documents are updated, and no messages are
waiting and no reviews are open.

| Who          | When to clear                                                                                                                                                                                                                          |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lead         | When a phase ends and there are no active team members and no open review requests. After updating and committing `docs/STATUS.md` and `docs/HANDOFF.md`. Before the conversation grows long enough to trigger automatic summarization |
| Team member  | Never. Each bundle gets one session. After the merge, the session is archived, and the next bundle starts in a new session                                                                                                             |
| Review agent | It's started fresh for each review request, so there's nothing to clear                                                                                                                                                                |

Every session, the lead included, can be compacted (summarized automatically) at
any time. `CLAUDE.md` under "Context and compaction" says how to survive it:
keep `.llp/notes.md` current, and the SessionStart hook prints the notes, the
git state, and `docs/STATUS.md` back after every compaction.

The current lead session is under Remote Control, so the app's rules don't let
it be cleared. When its context grows long, rely on compaction, but always keep
`.llp/notes.md`, `docs/STATUS.md`, and `docs/HANDOFF.md` up to date. When the
lead moves to a new session, the new session takes over with those two documents
and `docs/briefs/lead.md`.

The first message after a clear is always "Read CLAUDE.md, docs/HANDOFF.md, and
docs/STATUS.md, then continue."

## Port and app data folder assignments

Phase 1 makes the app read the dev server port (`LLP_DEV_PORT`) and the app data
folder (`LLP_USER_DATA`) from environment variables. With different app data
folders, several copies of the same app can run without colliding.

| Session | Port | App data folder     |
| ------- | ---- | ------------------- |
| lead    | 5173 | `D:\llp-dev\lead`   |
| trial   | 5190 | `D:\llp-dev\trial`  |
| devops  | 5185 | `D:\llp-dev\devops` |
| ui      | 5186 | `D:\llp-dev\ui`     |
| prep    | 5181 | `D:\llp-dev\prep`   |
| output  | 5182 | `D:\llp-dev\output` |
| tools   | 5183 | `D:\llp-dev\tools`  |
| polish  | 5184 | `D:\llp-dev\polish` |

The desktop app names a new worktree's branch itself, so each member renames it
to `rewrite/<name>` first (`git branch -m rewrite/<name>`). The SessionStart
hook tells sessions apart by that branch name.

## Windows pitfalls

- Keep the working folder path short. If the path is too long, node fails to
  start.
- `.gitattributes` fixes line endings to LF.
- Before a rebase or a merge, stop the dev app and the dev server in that
  folder. Windows locks files that are in use, and git fails.
- When you leave work running for a long time, keep the computer plugged in (on
  battery, it sleeps after 15 minutes).
- Don't use tmux. The Claude app starts and manages the sessions.

## GitHub

- Repository: https://github.com/0913vision/llpresenter (public). Only the lead
  pushes `rewrite`. Before the first push, confirm with the user that the
  repository is public.
- CI: GitHub Actions runs `npm ci` and `npm run verify` on a Windows runner when
  `rewrite` is pushed (set up by devops). The local `npm run verify` comes
  first. CI on GitHub checks once more in a clean environment.
- For now, reviews happen through review documents in the repository
  (`docs/reviews/`) and SendMessage, not through GitHub PRs, because this
  computer has no GitHub CLI (`gh`) and team members don't push. devops
  reconsiders GitHub PRs in phase 1 and makes a proposal in its review document,
  and the lead decides.
- When v1 is done, we fast-forward `main` to `rewrite`. This works because
  `rewrite` started from the last commit of `origin/main` (9b23462).

## Codex

- The lead decides with the user when to add Codex (around phase 3). The user
  installs it and signs in.
- Run it read-only so that it can't change code, and copy its results into the
  reviewer section of the review document.
