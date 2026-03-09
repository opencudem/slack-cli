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

```text
Use the slack-cli workflow for Slack data tasks.

Primary commands:
- session:import (header/json/file)
- session:check
- workspace:list
- view:channels
- view:dms
- view:messages (use --include-replies when thread context is needed)
- view:threads
- view:dm-messages

Output preference:
- Use --json for machine-readable outputs.
- Include workspace and command used in the response.
- If paginated, return next cursor and explain how to continue.

Troubleshooting:
- If auth fails, rerun session:import then session:check.
- If results are incomplete, increase --limit and page via --cursor.
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
