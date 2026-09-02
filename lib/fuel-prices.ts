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

export const stationOptions = [
  'PTT Station', 'Bangchak', 'Shell', 'Caltex', 'IRPC', 'PT', 'SUSCO', 'Pure', 'Sinopec / SUSCO',
];

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

export function getStationFuelPrice(data: FuelPriceResponse | null, stationName: string, fuelType: string): number | null {
  const station = data?.stations.find((item) => item.name === stationName);
  const fuelId = fuelTypeOptions.find((item) => item.value === fuelType)?.id
    ?? (fuelType === 'V-Power Gasohol 95' ? 'gs95p' : null);
  return station && fuelId ? station.prices[fuelId] ?? null : null;
}
