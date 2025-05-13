import { fetch, Response, RequestInit } from "undici";
import { setTimeout as sleep } from "node:timers/promises";

const MAX_RETRY = 3;

export async function safeFetch(
 url: string,
 init?: RequestInit,
 attempt = 0
): Promise<Response> {
 try {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt < MAX_RETRY) {
   const wait = Number(res.headers.get("retry-after") ?? "1") * 1_000;
   await sleep(wait);
   return safeFetch(url, init, attempt + 1);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res;
 } catch (err) {
  if (attempt < MAX_RETRY) {
   const backoff = 2 ** attempt * 500;
   await sleep(backoff);
   return safeFetch(url, init, attempt + 1);
  }
  throw err;
 }
}
