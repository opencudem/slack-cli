import { listAccounts, sessionFilePath } from "../state/auth-store.js";

export async function runAccountList(): Promise<void> {
  const index = await listAccounts();
  if (index.accounts.length === 0) {
    console.log("No accounts configured. Run session:import --account <name> first.");
    return;
  }

  console.log("Accounts:");
  for (const account of index.accounts) {
    const marker = account.name === index.activeAccount ? "*" : " ";
    const filePath = await sessionFilePath(account.name);
    const lastUsed = account.lastUsedAt ? ` | last used: ${account.lastUsedAt}` : "";
    console.log(
      `${marker} ${account.name} | imported: ${account.importedAt}${lastUsed} | file: ${filePath}`
    );
  }
  console.log("* active account");
}
