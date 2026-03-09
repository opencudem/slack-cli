# slack-cli

Cookie-first Slack CLI for reading Slack workspaces, channels, DMs, messages, and thread replies.

## Install

- Global install:
  - `npm install -g @opencudem/slack-cli`
- Run without global install:
  - `npx @opencudem/slack-cli session:check`

## CLI usage

### 1) Import and validate session

- Import from cookie header:
  - `slack-cli session:import --header "d=...; x=...; ..."`
- Import from cookie JSON file:
  - `slack-cli session:import --file ./cookies.json`
- Import from inline JSON:
  - `slack-cli session:import --json "[{\"name\":\"d\",\"value\":\"...\",\"domain\":\".slack.com\",\"path\":\"/\"}]"`
- Import into a named account:
  - `slack-cli session:import --account work --file ./cookies-work.json`
  - `slack-cli session:import --account personal --file ./cookies-personal.json`
  - Add `--no-set-active` to keep current active account unchanged.
- Validate session:
  - `slack-cli session:check`
  - `slack-cli session:check --account work`

### 2) Manage accounts

- List accounts:
  - `slack-cli account:list`
- Set active account:
  - `slack-cli account:use --account work`
- Remove non-active account:
  - `slack-cli account:remove --account personal`

If a legacy single-session file exists at `output/session.enc.json`, it is auto-migrated to account `default` on first auth access.

### 3) Discover workspaces

- `slack-cli workspace:list`
- `slack-cli workspace:list --account work`

### 4) Read channels, DMs, messages, and threads

Use workspace subdomain (example: `acme-team` for `https://acme-team.slack.com`).
For Enterprise Grid, use the full domain shown by `workspace:list` (example: `acme.enterprise.slack.com`).

- View channels:
  - `slack-cli view:channels --workspace acme-team --limit 50`
  - `slack-cli view:channels --workspace acme-team --json`
  - `slack-cli view:channels --account work --workspace acme-team --json`
- View DMs:
  - `slack-cli view:dms --workspace acme-team --limit 30`
  - `slack-cli view:dms --workspace acme-team --json`
- View messages in channel/DM:
  - `slack-cli view:messages --workspace acme-team --channel C1234567890 --limit 30`
  - `slack-cli view:messages --workspace acme-team --channel D1234567890 --oldest 1710000000.000100`
  - `slack-cli view:messages --workspace acme-team --channel C1234567890 --cursor dXNlcjpVMD...`
  - `slack-cli view:messages --workspace acme-team --channel C1234567890 --include-replies --json`
- View thread replies:
  - `slack-cli view:threads --workspace acme-team --channel C1234567890 --thread-ts 1710000000.000100 --limit 30`
  - `slack-cli view:threads --workspace acme-team --channel C1234567890 --thread-ts 1710000000.000100 --cursor dXNlcjpVMD...`
  - `slack-cli view:threads --workspace acme-team --channel C1234567890 --thread-ts 1710000000.000100 --json`
- DM alias command:
  - `slack-cli view:dm-messages --workspace acme-team --dm D1234567890 --limit 30`

### 5) Output behavior

- `view:dms` now prints both `peer` id and resolved `peerName`.
- `view:messages` and `view:threads` print both `user` id and resolved `userName`.
- If more data exists, the CLI prints `Next cursor`; pass it to `--cursor` for the next page.

## Development

- Install dependencies:
  - `npm install`
- Run in dev mode:
  - `npm run dev -- --help`
- Build:
  - `npm run build`
- Typecheck:
  - `npm run typecheck`
- Run local CLI build directly:
  - `node dist/cli.js workspace:list`

## READY to Copy: Agent Skill blurb

Use this exact block when asking an AI agent to operate this project:

````text
---
name: slack-cli-helper
description: Use this skill whenever the user asks to read or inspect Slack workspace data through this project's unofficial cookie-based `slack-cli` (channels, DMs, messages, threads, workspace discovery, account switching, session import/check). Trigger on requests mentioning Slack data extraction, channel history, DM history, thread replies, cursors/pagination, or cookie/session-based Slack access—even if the user does not explicitly say "use a skill." Do not treat this as Slack's official CLI or app-based OAuth flow.
---

# Slack CLI Helper (cookie-first, unofficial)

This skill guides an agent to use the installed `@opencudem/slack-cli` package correctly.

## What this skill is for

Use this when the user wants Slack data from their personal/account session using browser cookies, such as:
- listing accessible workspaces
- viewing channels or DMs
- reading messages in channels/DMs
- reading thread replies
- paginating with cursors
- switching between named local accounts

This is **not** Slack's official CLI workflow and does **not** require creating Slack apps, bot tokens, or OAuth installs.

## Operating rules

1. Treat this as an installed npm package workflow.
   - install globally: `npm install -g @opencudem/slack-cli`
   - or run without global install: `npx @opencudem/slack-cli <command and flags>`
2. If globally installed, prefer `slack-cli <command>`.
3. For automation/parsing, include `--json` whenever available.
4. Never ask users to post raw cookie values in public logs/chat if avoidable. Prefer local file input.
5. If auth/session fails, recover with `session:import` then `session:check`.

## Core command map

### Session/auth
- `session:import`
  - from file: `--file ./cookies.json`
  - from header: `--header "d=...; x=..."`
  - from inline json: `--json "[...]"`
  - optional account target: `--account <name>`
- `session:check`
  - validates active or specified account session

### Accounts
- `account:list`
- `account:use --account <name>`
- `account:remove --account <name>`

### Workspace discovery
- `workspace:list`

### Data reads
- `view:channels --workspace <workspace> [--limit N] [--json]`
- `view:dms --workspace <workspace> [--limit N] [--json]`
- `view:messages --workspace <workspace> --channel <C...|D...|G...> [--limit N] [--oldest TS] [--cursor CURSOR] [--include-replies] [--json]`
- `view:threads --workspace <workspace> --channel <C...|G...> --thread-ts <TS> [--limit N] [--cursor CURSOR] [--json]`
- `view:dm-messages --workspace <workspace> --dm <D...> [--limit N] [--oldest TS] [--cursor CURSOR] [--include-replies] [--json]`

## Recommended execution flow

1. **Ensure valid session**
   - run `slack-cli session:check` (or `npx @opencudem/slack-cli session:check`)
   - if invalid/missing: import session then re-check
2. **Confirm workspace**
   - run `slack-cli workspace:list` (or npx equivalent) if workspace is unknown
3. **Run the target read command**
   - channels/dms/messages/threads based on user ask
4. **Handle pagination**
   - if `next_cursor` (or printed next cursor) exists, offer follow-up command using `--cursor`
5. **Return concise result**
   - include command used, workspace used, and whether more pages exist

## Response template

When reporting results, use this structure:

```markdown
## Command
`<exact command>`

## Scope
- workspace: `<workspace>`
- account: `<account or active>`

## Result
- <short summary of rows/messages/channels found>

## Pagination
- next_cursor: `<value or none>`
- continue with: `<command including --cursor ...>`
````

## Examples

### Example 1: user asks "show latest messages in #eng"

1. Validate session:
   - `slack-cli session:check`
2. Resolve workspace/channel as needed, then:
   - `slack-cli view:messages --workspace acme-team --channel C1234567890 --limit 30 --json`
3. If paginated, continue with:
   - `slack-cli view:messages --workspace acme-team --channel C1234567890 --cursor <NEXT_CURSOR> --limit 30 --json`

### Example 2: user asks "list my DMs"

- `slack-cli view:dms --workspace acme-team --limit 30 --json`

### Example 3: auth failure recovery

1. `slack-cli session:import --account work --file ./cookies-work.json`
2. `slack-cli session:check --account work`
3. retry data command with `--account work`

## Troubleshooting heuristics

- "No active session/account": run `slack-cli account:list`, then `slack-cli account:use` or `slack-cli session:import`.
- "Unauthorized/invalid auth": re-import cookies and run `slack-cli session:check`.
- Incomplete results: increase `--limit` and page with `--cursor`.
- Enterprise Grid workspace handling: pass the domain style shown by `slack-cli workspace:list`.

## Boundaries

- Do not invent unsupported write operations.
- Do not claim official Slack CLI compatibility.
- Stay within read-oriented commands exposed by this project unless user explicitly confirms newer capabilities exist.

```

## TODO (Slack functionality backlog)

- [ ] Workspace discovery enhancements (metadata/details for each workspace).
- [ ] Conversation discovery parity (`public`, `private`, MPIM, and archived visibility controls).
- [ ] User directory lookups (`view:users`) with profile mapping for readable output.
- [ ] Message search support (workspace-level and channel-scoped search queries).
- [ ] Reactions support (list reactions on messages and summarize counts).
- [ ] File attachments visibility (metadata, shared links, and download-safe export mode).
- [ ] Thread quality-of-life helpers (reply pagination ergonomics and parent context inclusion).
- [ ] Message permalinks and quick-open helpers for exported data.
- [ ] Export pipeline for normalized JSON snapshots across channels/DMs/threads.
- [ ] Basic analytics summaries (activity counts by channel/user/time window).
- [ ] Robust rate-limit handling and retry/backoff telemetry in CLI output.
- [ ] Optional write operations (send/edit/delete) behind explicit safety flags.
- [ ] TUI foundation (interactive home screen, command palette, and status/footer bar).
- [ ] TUI navigation model (keyboard-first panes for workspaces, conversations, and message view).
- [ ] TUI message reader UX (thread preview, reply context, and inline metadata badges).
- [ ] TUI filter/search UX (incremental search, scope toggles, and saved filters).
- [ ] TUI performance and resilience (virtualized lists, non-blocking fetch states, graceful error toasts).

## Security notes

- Cookies are equivalent to an authenticated session; keep them private.
- Account sessions are encrypted and stored under `output/sessions/`.
- Legacy single-session state may still exist at `output/session.enc.json` and is auto-migrated.
- The encryption key is machine/user derived, so session files are not portable across machines/users.
```
