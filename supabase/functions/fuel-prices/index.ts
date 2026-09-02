import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const EPPO_API = "https://www.eppo.go.th/wp-json/oil-api/v1/oil-prices";
const MINISTRY_PAGE = "https://energy.go.th/th";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const fuels = [
  { id: "gh95", label: "แก๊สโซฮอล์ 95", field: "gh95" },
  { id: "gh91", label: "แก๊สโซฮอล์ 91", field: "gh91" },
  { id: "e20", label: "แก๊สโซฮอล์ E20", field: "e20" },
  { id: "e85", label: "แก๊สโซฮอล์ E85", field: "e85" },
  { id: "gl95", label: "เบนซิน 95", field: "gl95" },
  { id: "gs95p", label: "พรีเมียมแก๊สโซฮอล์ 95", field: "gs95p" },
  { id: "gs99p", label: "พรีเมียมแก๊สโซฮอล์ 99", field: "gs99p" },
  { id: "ds", label: "ดีเซล B7", field: "ds" },
  { id: "dsb20", label: "ดีเซล B20", field: "dsb20" },
  { id: "pds", label: "พรีเมียมดีเซล", field: "pds" },
] as const;

const stations = [
  { id: "ptt", name: "PTT Station", sourceKey: "ptt", prefix: "oil_ptt", color: "#1775bb" },
  { id: "bcp", name: "Bangchak", sourceKey: "bcp", prefix: "oil_bcp", color: "#10936d" },
  { id: "shell", name: "Shell", sourceKey: "shell", prefix: "oil_shell", color: "#dc2834" },
  { id: "caltex", name: "Caltex", sourceKey: "caltex", prefix: "oil_caltex", color: "#e32636" },
  { id: "irpc", name: "IRPC", sourceKey: "irpc", prefix: "oil_irpc", color: "#7856a6" },
  { id: "pt", name: "PT", sourceKey: "pt", prefix: "oil_pt", color: "#f47d22" },
  { id: "susco", name: "SUSCO", sourceKey: "susco1", prefix: "oil_susco1", color: "#2b9d55" },
  { id: "pure", name: "Pure", sourceKey: "pure", prefix: "oil_pure", color: "#5d68b2" },
  { id: "sinopec", name: "Sinopec / SUSCO", sourceKey: "susco2", prefix: "oil_susco2", color: "#d64045" },
] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readText(record: UnknownRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function readPrice(record: UnknownRecord, key: string): number | null {
  const value = Number(readText(record, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parsePayload(text: string): UnknownRecord {
  let parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, "").trim());
  if (typeof parsed === "string") parsed = JSON.parse(parsed.replace(/^\uFEFF/, "").trim());
  if (!isRecord(parsed)) throw new Error("Unexpected EPPO response");
  return parsed;
}

function basePrices() {
  return Object.fromEntries(fuels.map((fuel) => [fuel.id, null])) as Record<string, number | null>;
}

function fuelIdFromLabel(label: string): string | null {
  const value = label.toLowerCase().replace(/\s+/g, "");
  if (value.includes("premiumgasohol95") || value.includes("gasohol95premium")) return "gs95p";
  if (value.includes("premiumgasohol99") || value.includes("gasohol99premium")) return "gs99p";
  if (value.includes("premiumdiesel") || value.includes("dieselpremium")) return "pds";
  if (value.includes("gasohol95")) return "gh95";
  if (value.includes("gasohol91")) return "gh91";
  if (value === "e20" || value.includes("gasohole20")) return "e20";
  if (value === "e85" || value.includes("gasohole85")) return "e85";
  if (value.includes("gasoline95")) return "gl95";
  if (value.includes("dieselb20")) return "dsb20";
  if (value.includes("dieselb7") || value === "diesel") return "ds";
  return null;
}

function cellText(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": status === 200 ? "private, max-age=300" : "no-store",
    },
  });
}

async function fetchEppoPrices() {
  const response = await fetch(EPPO_API, {
    headers: { Accept: "application/json", "User-Agent": "Fuelly/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`EPPO returned ${response.status}`);

  const payload = parsePayload(await response.text());
  const data = payload.data;
  if (payload.status !== "success" || !isRecord(data)) throw new Error("EPPO data unavailable");

  return {
    source: "สำนักงานนโยบายและแผนพลังงาน (EPPO)",
    sourceUrl: "https://www.eppo.go.th/energy-price/oil-retail-price-today/",
    lastUpdated: typeof payload.last_updated === "string" ? payload.last_updated : null,
    fetchedAt: new Date().toISOString(),
    fuels: fuels.map(({ id, label }) => ({ id, label })),
    stations: stations.map((station) => {
      const stationData = data[station.sourceKey];
      const source = isRecord(stationData) ? stationData : {};
      const date = readText(source, `${station.prefix}_date`);
      const time = readText(source, `${station.prefix}_time`);
      return {
        id: station.id,
        name: station.name,
        color: station.color,
        effectiveAt: [date, time].filter(Boolean).join("T"),
        prices: Object.fromEntries(
          fuels.map((fuel) => [fuel.id, readPrice(source, `${station.prefix}_${fuel.field}`)]),
        ),
      };
    }),
  };
}

async function fetchMinistryPrices() {
  const response = await fetch(MINISTRY_PAGE, {
    headers: { Accept: "text/html", "Accept-Language": "th-TH,th;q=0.9", "User-Agent": "Fuelly/1.0" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Ministry returned ${response.status}`);

  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (declaredLength > 1_500_000) throw new Error("Ministry response too large");
  const html = await response.text();
  if (html.length > 1_500_000) throw new Error("Ministry response too large");

  const sectionIndex = html.indexOf("ราคาขายปลีก น้ำมัน");
  const tableStart = html.indexOf("<table", sectionIndex);
  const tableEnd = html.indexOf("</table>", tableStart);
  if (sectionIndex < 0 || tableStart < 0 || tableEnd < 0) throw new Error("Ministry price table unavailable");

  const table = html.slice(tableStart, tableEnd + 8);
  const body = table.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i)?.[1];
  if (!body) throw new Error("Ministry price rows unavailable");

  const priceMaps = Object.fromEntries(stations.map((station) => [station.id, basePrices()])) as Record<string, Record<string, number | null>>;
  const rows = body.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? [];
  for (const row of rows) {
    const cells = (row.match(/<td[^>]*>[\s\S]*?<\/td>/gi) ?? []).map(cellText);
    const fuelId = cells[0] ? fuelIdFromLabel(cells[0]) : null;
    if (!fuelId) continue;
    stations.forEach((station, index) => {
      const price = Number(cells[index + 1]);
      priceMaps[station.id][fuelId] = Number.isFinite(price) && price > 0 ? price : null;
    });
  }

  if (!stations.some((station) => priceMaps[station.id].gh95 !== null)) throw new Error("Ministry prices unavailable");
  const dateArea = html.slice(sectionIndex, tableStart);
  return {
    source: "กระทรวงพลังงาน",
    sourceUrl: MINISTRY_PAGE,
    lastUpdated: dateArea.match(/\d{1,2}\s+[ก-๙]+\s+25\d{2}/)?.[0] ?? null,
    fetchedAt: new Date().toISOString(),
    fuels: fuels.map(({ id, label }) => ({ id, label })),
    stations: stations.map((station) => ({
      id: station.id,
      name: station.name,
      color: station.color,
      effectiveAt: "",
      prices: priceMaps[station.id],
    })),
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST" && request.method !== "GET") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    try {
      return jsonResponse(await fetchEppoPrices());
    } catch (error) {
      console.warn(JSON.stringify({ event: "eppo_fallback", error: error instanceof Error ? error.message : "unknown" }));
      return jsonResponse(await fetchMinistryPrices());
    }
  } catch (error) {
    console.error(JSON.stringify({ event: "fuel_prices_fetch_failed", error: error instanceof Error ? error.message : "unknown" }));
    return jsonResponse({ error: "ยังดึงราคาน้ำมันล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง" }, 503);
  }
});
