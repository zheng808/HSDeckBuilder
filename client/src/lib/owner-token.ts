const KEY = 'hsdeck.ownerToken';

/** Anonymous identity: a random UUID created once per browser and sent on every request. */
export function getOwnerToken(): string {
  let token = localStorage.getItem(KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(KEY, token);
  }
  return token;
}
