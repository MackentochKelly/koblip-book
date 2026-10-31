# Plans

One file per project. Each file is the single source of truth for what is
planned, who is working on what, and what is done. Every developer keeps it
current.

| Plan | Status |
| --- | --- |
| [WhatsApp notifications v2](whatsapp-notifications.md) | In progress |
| [In-app notifications](in-app-notifications.md) | In progress |

## How to work with a plan

1. **Pick** a task marked `To do` whose "Needs" tasks are all `Done`.
2. **Claim it before you start**: set it to `Working on`, add your name and
   the date, then commit and push only that change
   (`Plan: working on W5`). Pull first; if someone claimed it already, pick
   another.
3. **Stay in the task's files.** Each task lists the files it owns. If you
   must touch another task's files, ask its owner first.
4. **Finish**: run typecheck, lint, test and build, then set the task to
   `Done` with the date and the commit, in the same commit as the work.
5. **Stuck or blocked**: set `Blocked`, say why in one line, and tell the
   developer who owns what you wait on.
6. **A decision is needed**: make the best one yourself, following the
   official docs and the plan's goals, and add it to the plan's Decisions log
   (what, why, who, date) in the same commit. Nobody waits for the owner.

One task at a time per developer. Never start a task whose "Needs" are not
done; work against the written contract instead when a task allows it.

## Status words

| Status | Meaning |
| --- | --- |
| `To do` | Nobody has started |
| `Working on` | Claimed: name and date |
| `Blocked` | Waiting on something, with the reason |
| `Done` | Merged, checks passed: date and commit |
| `Decision` | A choice still open; whoever needs it decides and logs it |
