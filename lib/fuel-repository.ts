import { supabase } from './supabase-client';

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

type FuelRecordRow = {
  id: string;
  user_id: string;
  date: string;
  station: string;
  fuel_type: string;
  liters: number | string;
  price_per_liter: number | string;
  total: number | string;
  current_odometer: number;
  previous_odometer: number;
  note: string;
};

const LOCAL_STORAGE_KEY = 'fuelly.records.v1';

const fromRow = (row: FuelRecordRow): FuelRecord => ({
  id: row.id,
  date: row.date,
  station: row.station,
  fuelType: row.fuel_type,
  liters: Number(row.liters),
  pricePerLiter: Number(row.price_per_liter),
  total: Number(row.total),
  currentOdometer: row.current_odometer,
  previousOdometer: row.previous_odometer,
  note: row.note,
});

const toRow = (record: FuelRecord, userId: string): FuelRecordRow => ({
  id: record.id,
  user_id: userId,
  date: record.date,
  station: record.station,
  fuel_type: record.fuelType,
  liters: record.liters,
  price_per_liter: record.pricePerLiter,
  total: record.total,
  current_odometer: record.currentOdometer,
  previous_odometer: record.previousOdometer,
  note: record.note,
});

export const fuelRepository = {
  async getAll(): Promise<FuelRecord[]> {
    const { data, error } = await supabase
      .from('fuel_records')
      .select('id,user_id,date,station,fuel_type,liters,price_per_liter,total,current_odometer,previous_odometer,note')
      .order('date', { ascending: false })
      .order('current_odometer', { ascending: false });
    if (error) throw error;
    return (data as FuelRecordRow[]).map(fromRow);
  },

  async save(record: FuelRecord, userId: string): Promise<void> {
    const { error } = await supabase.from('fuel_records').upsert(toRow(record, userId), { onConflict: 'id' });
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('fuel_records').delete().eq('id', id);
    if (error) throw error;
  },

  clearLegacyLocalRecords(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(LOCAL_STORAGE_KEY);
  },
};
