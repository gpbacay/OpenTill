export interface LocalUser {
  id: string;
  name: string;
  username: string;
}

interface LocalAccount extends LocalUser {
  salt: string;
  passwordHash: string;
  pendingPassword?: string;
}

const ACCOUNTS_KEY = "opentill_local_accounts";
const SESSION_KEY = "opentill_local_session";
const ITERATIONS = 100_000;

function readAccounts(): LocalAccount[] {
  try {
    const saved = localStorage.getItem(ACCOUNTS_KEY);
    if (!saved) return [];
    const parsed = JSON.parse(saved) as LocalAccount[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: LocalAccount[]) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function readLocalSession(): LocalUser | null {
  try {
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return null;
    const user = JSON.parse(saved) as LocalUser;
    if (!user?.id || !user.username) return null;
    return { id: user.id, name: user.name, username: user.username };
  } catch {
    return null;
  }
}

export function writeLocalSession(user: LocalUser | null) {
  if (!user) {
    localStorage.removeItem(SESSION_KEY);
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(user));
}

function bytesToHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function same(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

async function hashPassword(password: string, saltHex: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: hexToBytes(saltHex), iterations: ITERATIONS },
    key,
    256
  );
  return bytesToHex(new Uint8Array(bits));
}

export function newLocalId() {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
}

export async function rememberLocalAccount(
  user: LocalUser,
  password: string,
  pendingPassword?: string
) {
  const accounts = readAccounts();
  const existing = accounts.find((account) => account.id === user.id || account.username === user.username);
  const salt = existing?.salt ?? bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);
  const next: LocalAccount = {
    id: user.id,
    name: user.name,
    username: user.username,
    salt,
    passwordHash,
    ...(pendingPassword ? { pendingPassword } : {}),
  };
  writeAccounts([next, ...accounts.filter((account) => account.id !== next.id && account.username !== next.username)]);
}

export async function matchLocalAccount(username: string, password: string) {
  const account = readAccounts().find((item) => item.username === username.trim().toLowerCase());
  if (!account) return null;
  const hash = await hashPassword(password, account.salt);
  if (!same(hash, account.passwordHash)) return null;
  return account;
}

export function pendingAccounts() {
  return readAccounts().filter((account) => account.pendingPassword);
}

export function touchLocalAccount(user: LocalUser) {
  const accounts = readAccounts();
  const current = accounts.find((account) => account.id === user.id);
  if (!current) return;
  writeAccounts(
    accounts.map((account) =>
      account.id === user.id ? { ...account, name: user.name, username: user.username } : account
    )
  );
}

export function clearPendingPassword(id: string) {
  writeAccounts(
    readAccounts().map((account) => {
      if (account.id !== id) return account;
      const { pendingPassword: _pending, ...rest } = account;
      return rest;
    })
  );
}

export async function updateLocalAccount(
  userId: string,
  body: { name: string; username: string; currentPassword?: string; newPassword?: string }
) {
  const accounts = readAccounts();
  const current = accounts.find((account) => account.id === userId);
  if (!current) return "Sign in on this device first.";
  if (!body.name.trim()) return "Enter your name.";
  const username = body.username.trim().toLowerCase();
  if (!username) return "Enter a username.";
  if (body.newPassword && body.newPassword.length < 8) {
    return "Password must be at least 8 characters.";
  }
  const passwordChanged = Boolean(body.newPassword);
  const usernameChanged = username !== current.username;
  if (usernameChanged || passwordChanged) {
    if (!body.currentPassword) return "Current password is incorrect.";
    const hash = await hashPassword(body.currentPassword, current.salt);
    if (!same(hash, current.passwordHash)) return "Current password is incorrect.";
  }
  if (accounts.some((account) => account.username === username && account.id !== userId)) {
    return "That username is already in use.";
  }
  let salt = current.salt;
  let passwordHash = current.passwordHash;
  if (body.newPassword) {
    salt = bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
    passwordHash = await hashPassword(body.newPassword, salt);
  }
  const next: LocalAccount = {
    ...current,
    name: body.name.trim(),
    username,
    salt,
    passwordHash,
    ...(current.pendingPassword ? { pendingPassword: body.newPassword || current.pendingPassword } : {}),
  };
  writeAccounts(accounts.map((account) => (account.id === userId ? next : account)));
  return { id: next.id, name: next.name, username: next.username };
}
