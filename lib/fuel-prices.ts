import { supabase } from './supabase-client';

export type FuelOption = { id: string; label: string };
export type StationPrice = {
  id: string;
  name: string;
  color: string;
  effectiveAt: string;
  prices: Record<string, number | null>;
};
export type FuelPriceResponse = {
  source: string;
  sourceUrl: string;
  lastUpdated: string | null;
  fetchedAt: string;
  fuels: FuelOption[];
  stations: StationPrice[];
};

const stationCatalog = [
  { id: 'ptt', name: 'PTT Station', color: '#1775bb' },
  { id: 'bcp', name: 'Bangchak', color: '#10936d' },
  { id: 'shell', name: 'Shell', color: '#dc2834' },
  { id: 'caltex', name: 'Caltex', color: '#e32636' },
  { id: 'irpc', name: 'IRPC', color: '#7856a6' },
  { id: 'pt', name: 'PT', color: '#f47d22' },
  { id: 'susco', name: 'SUSCO', color: '#2b9d55' },
  { id: 'pure', name: 'Pure', color: '#5d68b2' },
  { id: 'sinopec', name: 'Sinopec / SUSCO', color: '#d64045' },
];

export const stationOptions = stationCatalog.map((station) => station.name);

export const fuelTypeOptions = [
  { id: 'gh95', value: 'Gasohol 95', label: 'แก๊สโซฮอล์ 95' },
  { id: 'gh91', value: 'Gasohol 91', label: 'แก๊สโซฮอล์ 91' },
  { id: 'e20', value: 'E20', label: 'แก๊สโซฮอล์ E20' },
  { id: 'e85', value: 'E85', label: 'แก๊สโซฮอล์ E85' },
  { id: 'gl95', value: 'Gasoline 95', label: 'เบนซิน 95' },
  { id: 'gs95p', value: 'Premium Gasohol 95', label: 'พรีเมียมแก๊สโซฮอล์ 95' },
  { id: 'gs99p', value: 'Premium Gasohol 99', label: 'พรีเมียมแก๊สโซฮอล์ 99' },
  { id: 'ds', value: 'Diesel B7', label: 'ดีเซล B7' },
  { id: 'dsb20', value: 'Diesel B20', label: 'ดีเซล B20' },
  { id: 'pds', value: 'Premium Diesel', label: 'พรีเมียมดีเซล' },
];

let cachedPrices: FuelPriceResponse | null = null;
let cachedAt = 0;
let pendingRequest: Promise<FuelPriceResponse> | null = null;
const historicalCache = new Map<string, FuelPriceResponse | null>();

type FuelPriceHistoryRow = {
  price_date: string;
  station_id: string;
  station_name: string;
  fuel_id: string;
  fuel_label: string;
  price: number | string;
  effective_at: string;
  source: string;
  source_url: string;
  fetched_at: string;
};

function isFuelPriceResponse(value: unknown): value is FuelPriceResponse {
  return typeof value === 'object' && value !== null && 'stations' in value && 'fuels' in value;
}

export async function getFuelPrices(force = false): Promise<FuelPriceResponse> {
  if (!force && cachedPrices && Date.now() - cachedAt < 5 * 60 * 1000) return cachedPrices;
  if (!force && pendingRequest) return pendingRequest;

  pendingRequest = (async () => {
    const { data, error } = await supabase.functions.invoke('fuel-prices');
    if (error || !isFuelPriceResponse(data)) throw new Error('Fuel price data unavailable');
    cachedPrices = data;
    cachedAt = Date.now();
    return data;
  })();

  try {
    return await pendingRequest;
  } finally {
    pendingRequest = null;
  }
}

export async function getFuelPricesForDate(date: string): Promise<FuelPriceResponse | null> {
  if (historicalCache.has(date)) return historicalCache.get(date) ?? null;

  const { data, error } = await supabase
    .from('fuel_price_history')
    .select('price_date,station_id,station_name,fuel_id,fuel_label,price,effective_at,source,source_url,fetched_at')
    .eq('price_date', date);
  if (error) throw error;

  const rows = (data ?? []) as FuelPriceHistoryRow[];
  if (!rows.length) {
    historicalCache.set(date, null);
    return null;
  }

  const result: FuelPriceResponse = {
    source: rows[0].source,
    sourceUrl: rows[0].source_url,
    lastUpdated: date,
    fetchedAt: rows.reduce((latest, row) => row.fetched_at > latest ? row.fetched_at : latest, rows[0].fetched_at),
    fuels: fuelTypeOptions.map(({ id, label }) => ({ id, label })),
    stations: stationCatalog.map((station) => {
      const stationRows = rows.filter((row) => row.station_id === station.id);
      return {
        ...station,
        effectiveAt: stationRows[0]?.effective_at ?? '',
        prices: Object.fromEntries(fuelTypeOptions.map((fuel) => {
          const row = stationRows.find((item) => item.fuel_id === fuel.id);
          return [fuel.id, row ? Number(row.price) : null];
        })),
      };
    }),
  };
  historicalCache.set(date, result);
  return result;
}

export function getStationFuelPrice(data: FuelPriceResponse | null, stationName: string, fuelType: string): number | null {
  const station = data?.stations.find((item) => item.name === stationName);
  const fuelId = fuelTypeOptions.find((item) => item.value === fuelType)?.id
    ?? (fuelType === 'V-Power Gasohol 95' ? 'gs95p' : null);
  return station && fuelId ? station.prices[fuelId] ?? null : null;
}
