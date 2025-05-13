import { safeFetch } from "./fetcher";
import type { CarInfo } from "./parser";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL!;
const CHUNK = 10; // 1 リクエスト最大 10 Embed

/* ── 色定数 ───────────────────────── */
const COLOR_HYBRID = 0xffd700; // 黄色
const COLOR_PREFERRED = 0xadff2f; // 黄緑

/* ── 判定用正規表現 ────────────────── */
const HYBRID_RE = /\b(?:HV|HEV)\b/i;
const PREFCAR_RE = /(アルファード|シエンタ|ヴォクシー|ノア)/i;

/**
 * 追加車両を Embed 形式で Discord Webhook へ送信
 * @param areaName 地域名（関東など）
 * @param cars     追加された車両リスト
 */
export async function notifyEmbeds(areaName: string, cars: CarInfo[]) {
 for (let i = 0; i < cars.length; i += CHUNK) {
  const slice = cars.slice(i, i + CHUNK);

  const embeds = slice.map((c) => {
   const textForCheck = `${c.model} ${c.conditions}`;
   const isPrefCar = PREFCAR_RE.test(c.model); // 車種優先
   const isHybrid = HYBRID_RE.test(textForCheck);

   let color: number | undefined;
   if (isPrefCar) color = COLOR_PREFERRED;
   else if (isHybrid) color = COLOR_HYBRID;

   return {
    title: c.model,
    description: [
     `**出発店舗**: ${c.startStore}`,
     `**返却店舗**: ${c.returnStore}`,
     `**出発期間**: ${c.period}`,
     `**車両条件**: ${c.conditions}`,
     `**電話**: ${c.phone}`,
    ].join("\n"),
    footer: { text: `車両番号 ${c.id}` },
    ...(color ? { color } : {}), // 条件に該当すれば色を付与
   };
  });

  await safeFetch(WEBHOOK_URL, {
   method: "POST",
   headers: { "Content-Type": "application/json" },
   body: JSON.stringify({
    content: `🆕 ${areaName}エリアに新規車両 (${embeds.length} 台)`,
    embeds,
   }),
  });
 }
}
