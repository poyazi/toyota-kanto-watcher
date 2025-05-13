import * as cheerio from "cheerio";
import * as crypto from "crypto";
import { safeFetch } from "./fetcher";

export interface CarInfo {
 id: string;
 model: string;
 conditions: string;
 period: string;
 startStore: string;
 returnStore: string;
 phone: string;
}

const TARGET_URL = "https://cp.toyota.jp/rentacar/";

/** 車両番号が無い場合にハッシュから擬似 ID を作る */
function makeDeterministicId(
 model: string,
 period: string,
 start: string
): string {
 const src = `${model}|${period}|${start}`;
 return crypto.createHash("sha1").update(src).digest("hex").slice(0, 8);
}

/** 指定エリアの “空きあり” 車両を取得（重複除去済み） */
export async function parseCars(areaId: number): Promise<CarInfo[]> {
 const html = await (
  await safeFetch(TARGET_URL, {
   headers: { "user-agent": "github-action" },
  })
 ).text();

 const $ = cheerio.load(html);
 const items = $(`li.service-item[data-start-area="${areaId}"]`).toArray();

 /* ── 空きありだけ抽出 ── */
 const active = items.filter((li) => {
  const body = $(li).find(".service-item__body");
  return !body.is(".show-entry-end") && !/受付終了|満車/.test(body.text());
 });

 /* ── データ化 ── */
 const cars: CarInfo[] = active.map((li) => {
  const txt = (sel: string) =>
   $(li).find(sel).not(".label-sp").text().trim().replace(/\s+/g, " ");

  const period = txt(".service-item__date p:first");
  const startStore = txt(".service-item__shop-start p");
  const returnStore = txt(".service-item__shop-return p");
  const carRaw = txt(".service-item__info__car-type p");
  const model = carRaw.replace(/車両番号.*$/, "").trim();
  const numMatch = carRaw.match(/車両番号\s*([0-9]+)/);

  const id = numMatch
   ? numMatch[1]
   : makeDeterministicId(model, period, startStore);

  return {
   id,
   model,
   conditions: txt(".service-item__info__condition p"),
   period,
   startStore,
   returnStore,
   phone: txt(".service-item__reserve-tel"),
  };
 });

 /* ── 同じ ID のカードが複数あれば 1 個に統合 ── */
 const uniq = new Map<string, CarInfo>();
 for (const car of cars) uniq.set(car.id, car);
 return Array.from(uniq.values());
}
