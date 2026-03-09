import { listAccounts, removeAccount } from "../state/auth-store.js";

interface AccountRemoveOptions {
  account: string;
}

export async function runAccountRemove(options: AccountRemoveOptions): Promise<void> {
  const account = options.account.toLowerCase();
  const index = await listAccounts();
  const exists = index.accounts.some((entry) => entry.name === account);
  if (!exists) {
    throw new Error(`Account '${account}' not found.`);
  }
  await removeAccount(account);
  console.log(`Removed account '${account}'.`);
}
