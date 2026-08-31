export type FuelRecord = {
  id: string;
  date: string;
  station: string;
  fuelType: string;
  liters: number;
  pricePerLiter: number;
  total: number;
  currentOdometer: number;
  previousOdometer: number;
  note: string;
};

export interface FuelRepository {
  getAll(): FuelRecord[];
  saveAll(records: FuelRecord[]): void;
}

export const sampleRecords: FuelRecord[] = [
  { id: 'sample-1', date: '2026-09-01', station: 'PTT Station', fuelType: 'Gasohol 95', liters: 31.45, pricePerLiter: 36.78, total: 1156.73, currentOdometer: 48520, previousOdometer: 48046, note: 'เดินทางในเมืองเป็นหลัก' },
  { id: 'sample-2', date: '2026-08-28', station: 'Bangchak', fuelType: 'Gasohol 95', liters: 32.4, pricePerLiter: 36.8, total: 1192.32, currentOdometer: 48046, previousOdometer: 47553, note: 'เติมเต็มถัง' },
  { id: 'sample-3', date: '2026-08-17', station: 'Shell', fuelType: 'V-Power Gasohol 95', liters: 29.85, pricePerLiter: 36.7, total: 1095.5, currentOdometer: 47553, previousOdometer: 47117, note: '' },
  { id: 'sample-4', date: '2026-08-06', station: 'Caltex', fuelType: 'Gasohol 95', liters: 36.2, pricePerLiter: 37.49, total: 1357.18, currentOdometer: 47117, previousOdometer: 46592, note: 'เดินทางต่างจังหวัด' },
  { id: 'sample-5', date: '2026-07-22', station: 'PTT Station', fuelType: 'Gasohol 91', liters: 33.1, pricePerLiter: 35.9, total: 1188.29, currentOdometer: 46592, previousOdometer: 46116, note: '' },
  { id: 'sample-6', date: '2026-07-07', station: 'Bangchak', fuelType: 'Gasohol 95', liters: 30.4, pricePerLiter: 36.5, total: 1109.6, currentOdometer: 46116, previousOdometer: 45661, note: '' },
  { id: 'sample-7', date: '2026-06-20', station: 'Esso', fuelType: 'Gasohol 95', liters: 35.5, pricePerLiter: 37.1, total: 1317.05, currentOdometer: 45661, previousOdometer: 45150, note: '' },
  { id: 'sample-8', date: '2026-05-29', station: 'Shell', fuelType: 'Gasohol 95', liters: 31.8, pricePerLiter: 36.9, total: 1173.42, currentOdometer: 45150, previousOdometer: 44688, note: '' },
  { id: 'sample-9', date: '2026-04-25', station: 'PTT Station', fuelType: 'Gasohol 95', liters: 34.6, pricePerLiter: 36.6, total: 1266.36, currentOdometer: 44688, previousOdometer: 44184, note: '' },
];

const STORAGE_KEY = 'fuelly.records.v1';

export const localFuelRepository: FuelRepository = {
  getAll() {
    if (typeof window === 'undefined') return sampleRecords;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleRecords));
      return sampleRecords;
    }
    try {
      return JSON.parse(stored) as FuelRecord[];
    } catch {
      return sampleRecords;
    }
  },
  saveAll(records) {
    if (typeof window !== 'undefined') window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  },
};

// Replace this exported implementation with a Supabase-backed repository later.
export const fuelRepository: FuelRepository = localFuelRepository;
