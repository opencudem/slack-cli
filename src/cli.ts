#!/usr/bin/env node
import { Command } from "commander";
import { runAccountList } from "./commands/account-list.js";
import { runAccountRemove } from "./commands/account-remove.js";
import { runAccountUse } from "./commands/account-use.js";
import { runSessionCheck } from "./commands/session-check.js";
import { runSessionImport } from "./commands/session-import.js";
import { runViewChannels } from "./commands/view-channels.js";
import { runViewDmMessages } from "./commands/view-dm-messages.js";
import { runViewDms } from "./commands/view-dms.js";
import { runViewMessages } from "./commands/view-messages.js";
import { runViewThreads } from "./commands/view-threads.js";
import { runWorkspaceList } from "./commands/workspace-list.js";

const program = new Command();

program
  .name("slack-cli")
  .description("Slack CLI (cookie-first)")
  .version("0.3.0");

program
  .command("session:import")
  .description("Import Slack browser cookies and save encrypted session")
  .option("--file <path>", "Path to cookie JSON array file")
  .option("--json <json>", "Raw cookie JSON array string")
  .option("--header <cookieHeader>", "Raw Cookie header value")
  .option("--base-url <url>", "Override base URL (default: https://app.slack.com)")
  .option("--account <name>", "Account name (default: active account or 'default')")
  .option("--no-set-active", "Do not set imported account as active")
  .action(
    async (options: {
      file?: string;
      json?: string;
      header?: string;
      baseUrl?: string;
      account?: string;
      setActive?: boolean;
    }) => {
      await runSessionImport(options);
    }
  );

program
  .command("session:check")
  .description("Validate saved Slack session")
  .option("--account <name>", "Account name (default: active account)")
  .action(async (options: { account?: string }) => {
    await runSessionCheck(options);
  });

program
  .command("workspace:list")
  .description("List workspace domains visible from authenticated response")
  .option("--account <name>", "Account name (default: active account)")
  .action(async (options: { account?: string }) => {
    await runWorkspaceList(options);
  });

program
  .command("view:channels")
  .description("View channels for a workspace")
  .requiredOption("--workspace <workspace>", "Workspace subdomain, e.g. gear-games")
  .option("--limit <n>", "Max rows", "50")
  .option("--json", "Emit JSON output")
  .option("--account <name>", "Account name (default: active account)")
  .action(async (options: { workspace: string; limit: string; json?: boolean; account?: string }) => {
    await runViewChannels({
      workspace: options.workspace,
      limit: Number(options.limit),
      json: Boolean(options.json),
      account: options.account
    });
  });

program
  .command("view:dms")
  .description("View direct messages for a workspace")
  .requiredOption("--workspace <workspace>", "Workspace subdomain, e.g. gear-games")
  .option("--limit <n>", "Max rows", "30")
  .option("--json", "Emit JSON output")
  .option("--account <name>", "Account name (default: active account)")
  .action(async (options: { workspace: string; limit: string; json?: boolean; account?: string }) => {
    await runViewDms({
      workspace: options.workspace,
      limit: Number(options.limit),
      json: Boolean(options.json),
      account: options.account
    });
  });

program
  .command("view:messages")
  .description("View channel/DM messages")
  .requiredOption("--workspace <workspace>", "Workspace subdomain, e.g. gear-games")
  .requiredOption("--channel <channelId>", "Channel/DM id (C..., G..., D...)")
  .option("--limit <n>", "Max rows", "30")
  .option("--oldest <ts>", "Oldest message ts to include")
  .option("--cursor <cursor>", "Cursor for next page")
  .option("--json", "Emit JSON output")
  .option("--include-replies", "Include replies from message threads")
  .option("--account <name>", "Account name (default: active account)")
  .action(
    async (options: {
      workspace: string;
      channel: string;
      limit: string;
      oldest?: string;
      cursor?: string;
      json?: boolean;
      includeReplies?: boolean;
      account?: string;
    }) => {
      await runViewMessages({
        workspace: options.workspace,
        channel: options.channel,
        limit: Number(options.limit),
        oldest: options.oldest,
        cursor: options.cursor,
        json: Boolean(options.json),
        includeReplies: Boolean(options.includeReplies),
        account: options.account
      });
    }
  );

program
  .command("view:threads")
  .description("View thread replies")
  .requiredOption("--workspace <workspace>", "Workspace subdomain, e.g. gear-games")
  .requiredOption("--channel <channelId>", "Channel id containing the thread")
  .requiredOption("--thread-ts <ts>", "Parent message ts")
  .option("--limit <n>", "Max rows", "30")
  .option("--cursor <cursor>", "Cursor for next page")
  .option("--json", "Emit JSON output")
  .option("--account <name>", "Account name (default: active account)")
  .action(
    async (options: {
      workspace: string;
      channel: string;
      threadTs: string;
      limit: string;
      cursor?: string;
      json?: boolean;
      account?: string;
    }) => {
      await runViewThreads({
        workspace: options.workspace,
        channel: options.channel,
        threadTs: options.threadTs,
        limit: Number(options.limit),
        cursor: options.cursor,
        json: Boolean(options.json),
        account: options.account
      });
    }
  );

program
  .command("view:dm-messages")
  .description("View messages in a DM (alias for view:messages with DM id)")
  .requiredOption("--workspace <workspace>", "Workspace subdomain, e.g. gear-games")
  .requiredOption("--dm <dmId>", "DM id (D...)")
  .option("--limit <n>", "Max rows", "30")
  .option("--oldest <ts>", "Oldest message ts to include")
  .option("--cursor <cursor>", "Cursor for next page")
  .option("--json", "Emit JSON output")
  .option("--include-replies", "Include replies from message threads")
  .option("--account <name>", "Account name (default: active account)")
  .action(
    async (options: {
      workspace: string;
      dm: string;
      limit: string;
      oldest?: string;
      cursor?: string;
      json?: boolean;
      includeReplies?: boolean;
      account?: string;
    }) => {
      await runViewDmMessages({
        workspace: options.workspace,
        dm: options.dm,
        limit: Number(options.limit),
        oldest: options.oldest,
        cursor: options.cursor,
        json: Boolean(options.json),
        includeReplies: Boolean(options.includeReplies),
        account: options.account
      });
    }
  );

program
  .command("account:list")
  .description("List configured accounts and active account")
  .action(async () => {
    await runAccountList();
  });

program
  .command("account:use")
  .description("Set active account")
  .requiredOption("--account <name>", "Account name")
  .action(async (options: { account: string }) => {
    await runAccountUse(options);
  });

program
  .command("account:remove")
  .description("Remove an account")
  .requiredOption("--account <name>", "Account name")
  .action(async (options: { account: string }) => {
    await runAccountRemove(options);
  });

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
