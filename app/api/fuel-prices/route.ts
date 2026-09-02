const EPPO_API = 'https://www.eppo.go.th/wp-json/oil-api/v1/oil-prices';

const fuels = [
  { id: 'gh95', label: 'แก๊สโซฮอล์ 95', field: 'gh95' },
  { id: 'gh91', label: 'แก๊สโซฮอล์ 91', field: 'gh91' },
  { id: 'e20', label: 'แก๊สโซฮอล์ E20', field: 'e20' },
  { id: 'e85', label: 'แก๊สโซฮอล์ E85', field: 'e85' },
  { id: 'gl95', label: 'เบนซิน 95', field: 'gl95' },
  { id: 'gs95p', label: 'พรีเมียมแก๊สโซฮอล์ 95', field: 'gs95p' },
  { id: 'gs99p', label: 'พรีเมียมแก๊สโซฮอล์ 99', field: 'gs99p' },
  { id: 'ds', label: 'ดีเซล B7', field: 'ds' },
  { id: 'dsb20', label: 'ดีเซล B20', field: 'dsb20' },
  { id: 'pds', label: 'พรีเมียมดีเซล', field: 'pds' },
] as const;

const stations = [
  { id: 'ptt', name: 'PTT Station', sourceKey: 'ptt', prefix: 'oil_ptt', color: '#1775bb' },
  { id: 'bcp', name: 'Bangchak', sourceKey: 'bcp', prefix: 'oil_bcp', color: '#10936d' },
  { id: 'shell', name: 'Shell', sourceKey: 'shell', prefix: 'oil_shell', color: '#dc2834' },
  { id: 'caltex', name: 'Caltex', sourceKey: 'caltex', prefix: 'oil_caltex', color: '#e32636' },
  { id: 'irpc', name: 'IRPC', sourceKey: 'irpc', prefix: 'oil_irpc', color: '#7856a6' },
  { id: 'pt', name: 'PT', sourceKey: 'pt', prefix: 'oil_pt', color: '#f47d22' },
  { id: 'susco', name: 'SUSCO', sourceKey: 'susco1', prefix: 'oil_susco1', color: '#2b9d55' },
  { id: 'pure', name: 'Pure', sourceKey: 'pure', prefix: 'oil_pure', color: '#5d68b2' },
  { id: 'sinopec', name: 'Sinopec / SUSCO', sourceKey: 'susco2', prefix: 'oil_susco2', color: '#d64045' },
] as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readText(record: UnknownRecord, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

function readPrice(record: UnknownRecord, key: string): number | null {
  const value = Number(readText(record, key));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parsePayload(text: string): UnknownRecord {
  let parsed: unknown = JSON.parse(text.replace(/^\uFEFF/, '').trim());
  if (typeof parsed === 'string') parsed = JSON.parse(parsed.replace(/^\uFEFF/, '').trim());
  if (!isRecord(parsed)) throw new Error('Unexpected EPPO response');
  return parsed;
}

export async function GET() {
  try {
    const response = await fetch(EPPO_API, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
      cf: { cacheEverything: true, cacheTtl: 300 },
    } as RequestInit);

    if (!response.ok) throw new Error(`EPPO returned ${response.status}`);

    const payload = parsePayload(await response.text());
    const data = payload.data;
    if (payload.status !== 'success' || !isRecord(data)) throw new Error('EPPO data unavailable');

    const normalizedStations = stations.map((station) => {
      const stationData = data[station.sourceKey];
      const source = isRecord(stationData) ? stationData : {};
      const date = readText(source, `${station.prefix}_date`);
      const time = readText(source, `${station.prefix}_time`);

      return {
        id: station.id,
        name: station.name,
        color: station.color,
        effectiveAt: [date, time].filter(Boolean).join('T'),
        prices: Object.fromEntries(
          fuels.map((fuel) => [fuel.id, readPrice(source, `${station.prefix}_${fuel.field}`)]),
        ),
      };
    });

    return Response.json(
      {
        source: 'สำนักงานนโยบายและแผนพลังงาน (EPPO)',
        sourceUrl: 'https://www.eppo.go.th/energy-price/oil-retail-price-today/',
        lastUpdated: typeof payload.last_updated === 'string' ? payload.last_updated : null,
        fetchedAt: new Date().toISOString(),
        fuels: fuels.map(({ id, label }) => ({ id, label })),
        stations: normalizedStations,
      },
      { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error(JSON.stringify({ event: 'fuel_prices_fetch_failed', error: error instanceof Error ? error.message : 'unknown' }));
    return Response.json(
      { error: 'ยังดึงราคาน้ำมันล่าสุดไม่ได้ กรุณาลองใหม่อีกครั้ง' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
