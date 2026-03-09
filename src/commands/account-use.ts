import { setActiveAccount } from "../state/auth-store.js";

interface AccountUseOptions {
  account: string;
}

export async function runAccountUse(options: AccountUseOptions): Promise<void> {
  const account = options.account.toLowerCase();
  await setActiveAccount(account);
  console.log(`Active account set to '${account}'.`);
}
