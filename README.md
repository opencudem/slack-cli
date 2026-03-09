# slack-cli

Cookie-first Slack CLI MVP.

## Install

- Global install (after publish):
  - `npm install -g @opencudem/slack-cli`
- Run without global install:
  - `npx @opencudem/slack-cli session:check`

## Open source release checklist

- [x] Pick final package name: `@opencudem/slack-cli`.
- [x] Update `LICENSE` copyright holder line.
- [x] Create a public GitHub repository under `opencudem` and add it as `origin`.
- [x] Push code to `main` (initial publish-ready commit).
- [ ] Login to npm (`npm login`) and verify access (`npm whoami`).
- [x] Dry run package contents (`npm pack --dry-run`).
- [ ] Publish initial release (`npm publish`).
- [x] Add repository metadata in `package.json` (`repository`, `bugs`, `homepage`, `publishConfig.access=public`).

## Cookie import

- Header mode:
  - `npm run dev -- session:import --header 'd=...; x=...; ...'`
- JSON file mode:
  - `npm run dev -- session:import --file ./cookies.json`
- Inline JSON mode:
  - `npm run dev -- session:import --json '[{"name":"d","value":"...","domain":".slack.com","path":"/"}]'`
- Import into a named account:
  - `npm run dev -- session:import --account work --file ./cookies-work.json`
  - `npm run dev -- session:import --account personal --file ./cookies-personal.json`
  - Add `--no-set-active` to keep the current active account unchanged.

## Session check

- `npm run dev -- session:check`
- `npm run dev -- session:check --account work`

## Account management

- List accounts:
  - `npm run dev -- account:list`
- Switch active account:
  - `npm run dev -- account:use --account work`
- Remove non-active account:
  - `npm run dev -- account:remove --account personal`

If a legacy single-session file exists at `output/session.enc.json`, it is auto-migrated to account `default` on first auth access.

## Workspace helper

- `npm run dev -- workspace:list`
- `npm run dev -- workspace:list --account work`

## Basic read commands (single workspace)

Use workspace subdomain (example: `gear-games` for `https://gear-games.slack.com`).
For Enterprise Grid style workspaces, use the full domain shown by `workspace:list` (example: `seconddinner.enterprise.slack.com`).

- View channels:
  - `npm run dev -- view:channels --workspace gear-games --limit 50`
  - `npm run dev -- view:channels --workspace gear-games --json`
  - `npm run dev -- view:channels --account work --workspace gear-games --json`
- View DMs:
  - `npm run dev -- view:dms --workspace gear-games --limit 30`
  - `npm run dev -- view:dms --workspace gear-games --json`
- View messages in channel/DM:
  - `npm run dev -- view:messages --workspace gear-games --channel C1234567890 --limit 30`
  - `npm run dev -- view:messages --workspace gear-games --channel D1234567890 --oldest 1710000000.000100`
  - `npm run dev -- view:messages --workspace gear-games --channel C1234567890 --cursor dXNlcjpVMD...`
  - `npm run dev -- view:messages --workspace gear-games --channel C1234567890 --json`
- View thread replies:
  - `npm run dev -- view:threads --workspace gear-games --channel C1234567890 --thread-ts 1710000000.000100 --limit 30`
  - `npm run dev -- view:threads --workspace gear-games --channel C1234567890 --thread-ts 1710000000.000100 --cursor dXNlcjpVMD...`
  - `npm run dev -- view:threads --workspace gear-games --channel C1234567890 --thread-ts 1710000000.000100 --json`
- DM alias command:
  - `npm run dev -- view:dm-messages --workspace gear-games --dm D1234567890 --limit 30`

## Output tips

- `view:dms` now prints both `peer` id and resolved `peerName`.
- `view:messages` and `view:threads` print both `user` id and resolved `userName`.
- If more data exists, the CLI prints `Next cursor`; pass it to `--cursor` for the next page.

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
