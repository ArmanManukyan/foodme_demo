---
name: jira-bug
description: Reproduce a FoodMe defect on the deployed site, then file it in Jira project KAN with title, environment/SUT, steps, expected vs actual, severity and labels. Also comment on KAN tickets and move them through statuses.
when_to_use: Use when asked to file, report or log a bug, or to comment on, update, verify or move a KAN ticket (for example "move KAN-4 to Done").
argument-hint: "[file|comment|move] <bug description or KAN-key>"
allowed-tools: mcp__claude_ai_Atlassian_MCP__searchJiraIssuesUsingJql mcp__claude_ai_Atlassian_MCP__getJiraIssue mcp__claude_ai_Atlassian_MCP__executeRead
---

# Work with FoodMe bugs in Jira

Request: $ARGUMENTS

## Project facts

| | |
|---|---|
| Site (`cloudId`) | `armanmanukyan139.atlassian.net` |
| Project | `KAN` ("FoodMe"), team-managed |
| Issue types | `Bug`, `Task`, `Story`, `Epic`, `Subtask` |
| Statuses | `To Do` → `In Progress` → `In Review` → `Done` |
| SUT | https://foodme-armanmanukyan.onrender.com (storefront `/`, admin `/backoffice`) |

Use `Bug` for a product defect. Use `Task` for a problem only in tests or tooling, such as an `FM-FLAKE-NN` test.

Fields on the Bug create screen, checked 2026-11-06:
- **There is no Severity field and no Environment field.** Both go in the description, and severity also goes in a label.
- **`priority` is not on the create screen.** `KAN-4` got the default `Medium`. Don't pass `priority` to `createJiraIssue`.

If a create call rejects a field, check again with `getJiraIssueTypeMetaWithFields` (`issueTypeId: "10010"`, `requiredFieldsOnly: false`).

## Filing a bug

### 1. Reproduce first

Never file from reading code or from a report alone.

1. Wake the SUT. The free tier sleeps and can take 1–3 minutes: `curl -s -m 180 https://foodme-armanmanukyan.onrender.com/actuator/health` must return `UP`.
2. Follow the exact steps in a browser or with Playwright, starting from a clean state (empty cart, fresh account). From `apps/web`:
   ```bash
   PLAYWRIGHT_BASE_URL=https://foodme-armanmanukyan.onrender.com \
   VITE_API_BASE_URL=https://foodme-armanmanukyan.onrender.com \
   npx playwright test e2e/<feature>.spec.ts --workers=1 --retries=0
   ```
3. Reproduce at least **twice**, and try the neighboring values (for example quantity 1, 2 and 3). This shows how far the bug reaches.
4. Record the browser and version, the date and time, the commit, and test data such as chef and dish names. Take the commit from `git log -1 origin/main`, and write "not confirmed" if you can't confirm that it's what's deployed.

**Stop and don't file** if it doesn't reproduce: report what you tried. A Playwright timeout alone isn't a bug. On this slow server, valid tests time out at the default 5 s while it warms up. Rerun with one worker, and only continue if the wrong behavior is visible.

Testing on the SUT creates real accounts and orders. Use throwaway data like `e2e-<timestamp>@example.com`.

### 2. Check for duplicates

```
project = KAN AND issuetype = Bug AND text ~ "<key words>" ORDER BY created DESC
```
Also search `labels = "FM-BUG-NN"` if the code has a tag. If a ticket already exists, comment on it instead of filing a new one.

### 3. Draft

**Title:** `<Area>: <what goes wrong> instead of <expected>`
Example from `KAN-4`: `Basket: pressing "−" on an item with quantity 2 removes the item entirely instead of setting quantity to 1`

**Description** (markdown):
```markdown
## Summary
<One or two sentences.>

## Environment
* **SUT:** https://foodme-armanmanukyan.onrender.com/
* **Page:** <URL or page>
* **Build:** commit `<sha>` "<subject>" (Render deploy: <status or not confirmed>)
* **Browser:** <name and version, OS>
* **Date:** <YYYY-MM-DD, HH:MM> (Asia/Yerevan, UTC+4)

## Steps to reproduce
1. <Start from a known state, with exact data and exact button names.>

## Actual result
<What happened, as observed.>

## Expected result
<What should happen, and where that expectation comes from.>

## Observed during reproduction
| Input | Action | Actual | Expected | Result |
| --- | --- | --- | --- | --- |

Reproducibility: <n/n> runs.

## Severity
<Critical|High|Medium|Low>: <one-line reason>

## Notes
* <Scope, what wasn't checked, suspected code as `path:function`. Mark guesses as guesses.>
```

**Severity** is how badly users are affected:

| Label | Meaning |
|---|---|
| `severity-critical` | Site down, ordering impossible, data loss, or security exposure |
| `severity-high` | A core flow is broken or a wrong amount is charged, with no reasonable workaround |
| `severity-medium` | A feature misbehaves but has a workaround (`KAN-4`-style cart bugs) |
| `severity-low` | Cosmetic or minor |

**Labels:** always `reproduced` and one `severity-*`, plus an area such as `basket`, `checkout`, `chef-list` or `admin`, plus the `FM-BUG-NN` tag if the code has one. Labels can't contain spaces.

### 4. Confirm, then create

Show the user the full draft and wait for approval, unless they explicitly told you to file it in this request. Then call `createJiraIssue`:
```json
{ "cloudId": "armanmanukyan139.atlassian.net", "projectKey": "KAN", "issueType": "Bug",
  "summary": "...", "description": "...", "labels": ["reproduced", "severity-medium", "basket"] }
```
Report the new key and `webUrl`. Don't create it twice if the response is slow: search first.

## Commenting

Use `addOrEditJiraIssueComment` with `issueIdOrKey`, `commentBody` in markdown. Leave out `commentId`: passing one replaces that comment's whole body.

State facts and evidence, as in `KAN-4`: **Root cause**, **Fix** (commit or PR), **Verified** (where, when, and with what result), and the status and next step. Read the ticket first with `getJiraIssue` (`view: "evidence"`) so you don't repeat earlier comments.

## Moving through statuses

1. Call `listJiraIssueTransitions` through `executeRead` to get what this issue can do right now. These IDs were correct on 2026-11-06, but the response is the authority:

   | Target status | Transition id | Move when |
   |---|---|---|
   | `To Do` | `11` | Newly filed, or reopened because it reproduces again |
   | `In Progress` | `21` | Someone is actively fixing it |
   | `In Review` | `31` | A fix PR is open, and the link is in a comment |
   | `Done` | `41` | The fix is deployed **and** verified on the SUT |

2. Add the comment first, using `addOrEditJiraIssueComment`. A comment passed through the transition's `update` field can be silently dropped.
3. Call `transitionJiraIssue` with `issueIdOrKey` and `transitionId`, then report the status it returns.

Before `Done`: rerun the reproduction steps on the SUT, and comment with the date, commit and result. If the bug still reproduces, move it to `To Do` with that evidence. Move a ticket only when the user asked for that status change or the current task clearly includes it.
