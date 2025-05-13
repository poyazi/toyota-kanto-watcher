/**
 * Toyota Rent-a-Car 関東タブ監視 BOT
 * 役割: 差分検出・キャッシュ更新・通知オーケストレーション
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseCars, type CarInfo } from "./parser";
import { notifyEmbeds } from "./notifier";

const AREA_ID = 3; // 3 = 関東
const AREA_NAME = "関東";

const CACHE = path.resolve(".cache/latest.json");
const TMP = `${CACHE}.tmp`;

/* ---------- 差分判定に使う安定キー ---------- */
const key = (c: CarInfo) =>
 JSON.stringify({
  id: c.id,
  model: c.model,
  conditions: c.conditions,
  period: c.period,
  startStore: c.startStore,
  returnStore: c.returnStore,
  phone: c.phone,
 });

/* ---------- メイン ---------- */
async function main() {
 const newList = await parseCars(AREA_ID);

 const oldList: CarInfo[] = JSON.parse(
  await fs.readFile(CACHE, { encoding: "utf8" }).catch(() => "[]")
 );

 const oldSet = new Set(oldList.map(key));
 const added = newList.filter((c) => !oldSet.has(key(c)));

 /* ---- キャッシュを tmp に先書き（原子リネーム戦略） ---- */
 await fs.mkdir(path.dirname(CACHE), { recursive: true });
 await fs.writeFile(TMP, JSON.stringify(newList, null, 2), {
  encoding: "utf8",
 });

 try {
  if (added.length) {
   await notifyEmbeds(AREA_NAME, added);
   console.log(`Notified ${added.length} additions`);
  } else {
   console.log("No new active cars");
  }

  /* 送信成功 → 正式キャッシュへ置き換え */
  await fs.rename(TMP, CACHE);
 } catch (err) {
  console.error("通知失敗: キャッシュは旧状態を保持", err);
  await fs.rm(TMP, { force: true }); // ロールバック
  throw err; // ジョブ失敗扱い
 }
}

main().catch((e) => {
 process.exitCode = 1; // GitHub Actions を赤くする
});
