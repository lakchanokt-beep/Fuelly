'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase-client';

type FuelOption = { id: string; label: string };
type StationPrice = {
  id: string;
  name: string;
  color: string;
  effectiveAt: string;
  prices: Record<string, number | null>;
};
type FuelPriceResponse = {
  source: string;
  sourceUrl: string;
  lastUpdated: string | null;
  fetchedAt: string;
  fuels: FuelOption[];
  stations: StationPrice[];
};

const priceFormat = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function updateLabel(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('th-TH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok',
  }).format(date);
}

export default function FuelPriceBoard() {
  const [data, setData] = useState<FuelPriceResponse | null>(null);
  const [selectedFuel, setSelectedFuel] = useState('gh95');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadPrices = useCallback(async () => {
    try {
      const { data: result, error: functionError } = await supabase.functions.invoke('fuel-prices');
      if (functionError || typeof result !== 'object' || result === null || !('stations' in result)) {
        throw new Error('Fuel price data unavailable');
      }
      setError('');
      setData(result as FuelPriceResponse);
    } catch {
      setError('ยังอัปเดตราคาไม่ได้ ลองใหม่อีกครั้งนะ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoad = window.setTimeout(() => void loadPrices(), 0);
    const timer = window.setInterval(() => void loadPrices(), 5 * 60 * 1000);
    return () => { window.clearTimeout(initialLoad); window.clearInterval(timer); };
  }, [loadPrices]);

  const sortedStations = useMemo(() => {
    if (!data) return [];
    return [...data.stations].sort((a, b) => {
      const aPrice = a.prices[selectedFuel];
      const bPrice = b.prices[selectedFuel];
      if (aPrice === null) return 1;
      if (bPrice === null) return -1;
      return aPrice - bPrice;
    });
  }, [data, selectedFuel]);

  const availablePrices = sortedStations.map((station) => station.prices[selectedFuel]).filter((price): price is number => price !== null);
  const lowestPrice = availablePrices.length ? Math.min(...availablePrices) : null;
  const selectedLabel = data?.fuels.find((fuel) => fuel.id === selectedFuel)?.label ?? 'น้ำมัน';

  return (
    <article className="panel fuel-price-panel">
      <div className="fuel-price-heading">
        <div>
          <div className="live-kicker"><span /> ราคาล่าสุดจากแหล่งข้อมูลทางการ</div>
          <h2>ราคาน้ำมันวันนี้</h2>
          <p>เปรียบเทียบราคาขายปลีกมาตรฐานจากเครือข่ายสถานีบริการทั่วไทย</p>
        </div>
        <div className="fuel-price-actions">
          <span className="price-updated">อัปเดต {updateLabel(sortedStations[0]?.effectiveAt || data?.fetchedAt)}</span>
          <button className="refresh-price" onClick={() => { setLoading(true); void loadPrices(); }} disabled={loading} aria-label="อัปเดตราคาน้ำมัน">
            <span className={loading ? 'spinning' : ''}>↻</span> อัปเดต
          </button>
        </div>
      </div>

      {data && <div className="fuel-tabs" role="tablist" aria-label="เลือกชนิดน้ำมัน">
        {data.fuels.map((fuel) => <button key={fuel.id} role="tab" aria-selected={selectedFuel === fuel.id} className={selectedFuel === fuel.id ? 'active' : ''} onClick={() => setSelectedFuel(fuel.id)}>{fuel.label}</button>)}
      </div>}

      {loading && !data && <div className="price-loading"><span className="sync-spinner" /><p>กำลังดึงราคาล่าสุด…</p></div>}
      {error && !data && <div className="price-error"><span>☁</span><p>{error}</p><button onClick={() => { setLoading(true); void loadPrices(); }}>ลองใหม่</button></div>}

      {data && <>
        <div className="station-price-grid">
          {sortedStations.map((station) => {
            const price = station.prices[selectedFuel];
            const isLowest = price !== null && price === lowestPrice;
            return <section className={`station-price-card ${isLowest ? 'lowest' : ''}`} key={station.id} style={{ borderTopColor: station.color }}>
              <div className="station-price-brand"><span style={{ backgroundColor: `${station.color}18`, color: station.color }}>{station.name.slice(0, 2).toUpperCase()}</span><strong>{station.name}</strong></div>
              {isLowest && <small className="lowest-pill">ราคาต่ำสุด</small>}
              <div className="station-price-value">{price === null ? <span className="no-price">ไม่มีจำหน่าย</span> : <><strong>{priceFormat.format(price)}</strong><span>บาท/ลิตร</span></>}</div>
              <small>มีผล {station.effectiveAt ? updateLabel(station.effectiveAt) : data.lastUpdated ?? 'ล่าสุด'}</small>
            </section>;
          })}
        </div>
        <div className="fuel-price-foot">
          <span>ราคา {selectedLabel} • กทม.และปริมณฑล • ยังไม่รวมภาษีบำรุงท้องถิ่น</span>
          <a href={data.sourceUrl} target="_blank" rel="noreferrer">ที่มา: {data.source} ↗</a>
        </div>
      </>}
    </article>
  );
}
