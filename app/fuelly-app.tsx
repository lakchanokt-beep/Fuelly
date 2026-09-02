'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { fuelRepository, FuelRecord } from '../lib/fuel-repository';
import { signInWithGoogle, supabase } from '../lib/supabase-client';
import { FuelPriceResponse, fuelTypeOptions, getFuelPrices, getFuelPricesForDate, getStationFuelPrice, stationOptions } from '../lib/fuel-prices';
import FuelPriceBoard from './fuel-price-board';

type View = 'dashboard' | 'history' | 'analytics' | 'report';
type FormState = Omit<Record<keyof FuelRecord, string>, 'id'> & { id: string };

const views: { id: View; label: string; short: string; icon: string }[] = [
  { id: 'dashboard', label: 'ภาพรวม', short: 'ภาพรวม', icon: '⌂' },
  { id: 'history', label: 'ประวัติการเติม', short: 'ประวัติ', icon: '◷' },
  { id: 'analytics', label: 'สถิติและวิเคราะห์', short: 'วิเคราะห์', icon: '⌁' },
  { id: 'report', label: 'รายงานรายเดือน', short: 'รายงาน', icon: '▤' },
];

const bangkokDateKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const emptyForm = (): FormState => ({
  id: '', date: bangkokDateKey(), station: '', fuelType: 'Gasohol 95',
  liters: '', pricePerLiter: '', total: '', currentOdometer: '', previousOdometer: '', note: '',
});

const numberFormat = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 });
const baht = (value: number) => `฿${numberFormat.format(value)}`;
const monthKey = (date: string) => date.slice(0, 7);
const monthLabel = (key: string, style: 'short' | 'long' = 'short') => new Intl.DateTimeFormat('th-TH', { month: style, year: style === 'long' ? 'numeric' : undefined }).format(new Date(`${key}-01T12:00:00`));
const dateLabel = (date: string) => new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }).format(new Date(`${date}T12:00:00`));
const distance = (record: FuelRecord) => record.currentOdometer !== null && record.previousOdometer !== null
  ? Math.max(0, record.currentOdometer - record.previousOdometer)
  : 0;
const efficiency = (record: FuelRecord) => record.liters > 0 ? distance(record) / record.liters : 0;
const costPerKm = (record: FuelRecord) => distance(record) > 0 ? record.total / distance(record) : 0;
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function StatCard({ tone, icon, label, value, note }: { tone: string; icon: string; label: string; value: string; note: string }) {
  return <article className={`stat-card ${tone}`}><div className="stat-icon">{icon}</div><p>{label}</p><strong>{value}</strong><small>{note}</small></article>;
}

export default function FuellyApp() {
  const [records, setRecords] = useState<FuelRecord[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [view, setView] = useState<View>('dashboard');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [search, setSearch] = useState('');
  const [stationFilter, setStationFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [reportMonth, setReportMonth] = useState(new Date().toISOString().slice(0, 7));
  const [toast, setToast] = useState('');
  const [fuelPriceData, setFuelPriceData] = useState<FuelPriceResponse | null>(null);
  const [fuelPriceLoading, setFuelPriceLoading] = useState(false);
  const [priceLookupStatus, setPriceLookupStatus] = useState<'idle' | 'live' | 'history' | 'missing' | 'error'>('idle');
  const priceRequestId = useRef(0);
  const userId = user?.id ?? null;

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (mounted) {
        setUser(data.user ?? null);
        setAuthLoading(false);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      setAuthLoading(false);

      // Supabase refreshes tokens when a background tab becomes active again.
      // The account has not changed, so do not trigger another history sync.
      if (event === 'TOKEN_REFRESHED') return;

      const nextUser = session?.user ?? null;
      setUser((currentUser) => currentUser?.id === nextUser?.id ? currentUser : nextUser);
      if (event === 'SIGNED_OUT') {
        setRecords([]);
        setDataLoading(false);
      }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    let timedOut = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12_000);
    const start = window.setTimeout(() => {
      setDataLoading(true);
      void (async () => {
        try {
          fuelRepository.clearLegacyLocalRecords();
          const next = await fuelRepository.getAll(controller.signal);
          if (mounted) setRecords(next);
        } catch (error) {
          if (mounted && (timedOut || !(error instanceof DOMException && error.name === 'AbortError'))) {
            setToast(timedOut ? 'การซิงก์ใช้เวลานานเกินไป กรุณาลองใหม่' : 'เชื่อมต่อข้อมูลไม่สำเร็จ กรุณาลองใหม่');
          }
        } finally {
          window.clearTimeout(timeout);
          if (mounted) setDataLoading(false);
        }
      })();
    }, 0);
    return () => {
      mounted = false;
      controller.abort();
      window.clearTimeout(start);
      window.clearTimeout(timeout);
    };
  }, [userId]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const sorted = useMemo(() => [...records].sort((a, b) => b.date.localeCompare(a.date) || (b.currentOdometer ?? 0) - (a.currentOdometer ?? 0)), [records]);
  const months = useMemo(() => [...new Set(sorted.map((record) => monthKey(record.date)))], [sorted]);
  const selectedReportMonth = months.length && !months.includes(reportMonth) ? months[0] : reportMonth;
  const latestMonth = months[0] ?? new Date().toISOString().slice(0, 7);
  const currentRecords = sorted.filter((record) => monthKey(record.date) === latestMonth);
  const totalCost = sum(currentRecords.map((record) => record.total));
  const totalDistance = sum(currentRecords.map(distance));
  const totalLiters = sum(currentRecords.map((record) => record.liters));
  const measuredLiters = sum(currentRecords.filter((record) => distance(record) > 0).map((record) => record.liters));
  const averageEfficiency = measuredLiters ? totalDistance / measuredLiters : 0;
  const previousMonthRecords = sorted.filter((record) => monthKey(record.date) === months[1]);
  const previousCost = sum(previousMonthRecords.map((record) => record.total));
  const costChange = previousCost ? ((totalCost - previousCost) / previousCost) * 100 : 0;

  const monthStats = useMemo(() => months.slice(0, 6).reverse().map((key) => {
    const items = sorted.filter((record) => monthKey(record.date) === key);
    const liters = sum(items.map((record) => record.liters));
    const km = sum(items.map(distance));
    const measuredMonthLiters = sum(items.filter((record) => distance(record) > 0).map((record) => record.liters));
    return { key, cost: sum(items.map((record) => record.total)), liters, distance: km, efficiency: measuredMonthLiters ? km / measuredMonthLiters : 0, count: items.length };
  }), [months, sorted]);
  const chartMax = Math.max(...monthStats.map((item) => item.cost), 1);
  const latestMeasuredRecord = sorted.find((record) => distance(record) > 0);

  const filteredRecords = useMemo(() => sorted.filter((record) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${record.station} ${record.fuelType} ${record.note}`.toLowerCase().includes(query);
    return matchesSearch && (stationFilter === 'all' || record.station === stationFilter) && (monthFilter === 'all' || monthKey(record.date) === monthFilter);
  }), [sorted, search, stationFilter, monthFilter]);

  const reportRecords = sorted.filter((record) => monthKey(record.date) === selectedReportMonth);
  const reportCost = sum(reportRecords.map((record) => record.total));
  const reportDistance = sum(reportRecords.map(distance));
  const reportLiters = sum(reportRecords.map((record) => record.liters));
  const measuredReportLiters = sum(reportRecords.filter((record) => distance(record) > 0).map((record) => record.liters));
  const reportEfficiency = measuredReportLiters ? reportDistance / measuredReportLiters : 0;
  const selectedReferencePrice = getStationFuelPrice(fuelPriceData, form.station, form.fuelType);

  const loadFormFuelPrices = async (date: string, applyPrice = false) => {
    const requestId = ++priceRequestId.current;
    const isToday = date === bangkokDateKey();
    setFuelPriceLoading(true);
    setPriceLookupStatus('idle');
    if (applyPrice) {
      setForm((current) => current.date === date ? { ...current, pricePerLiter: '', liters: '' } : current);
    }
    try {
      const nextData = isToday ? await getFuelPrices() : await getFuelPricesForDate(date);
      if (requestId !== priceRequestId.current) return;
      setFuelPriceData(nextData);
      setPriceLookupStatus(nextData ? (isToday ? 'live' : 'history') : 'missing');
      if (applyPrice) {
        setForm((current) => {
          if (current.date !== date) return current;
          const referencePrice = getStationFuelPrice(nextData, current.station, current.fuelType);
          if (!referencePrice) return { ...current, pricePerLiter: '', liters: '' };
          return {
            ...current,
            pricePerLiter: referencePrice.toFixed(2),
            liters: Number(current.total) > 0 ? (Number(current.total) / referencePrice).toFixed(2) : '',
          };
        });
      }
    } catch {
      if (requestId !== priceRequestId.current) return;
      setFuelPriceData(null);
      setPriceLookupStatus('error');
      setToast(isToday ? 'ยังดึงราคาน้ำมันล่าสุดไม่ได้ สามารถกรอกราคาเองได้' : 'ค้นหาราคาย้อนหลังไม่สำเร็จ สามารถกรอกจากใบเสร็จได้');
    } finally {
      if (requestId === priceRequestId.current) setFuelPriceLoading(false);
    }
  };

  const openAdd = () => {
    const latestOdometer = sorted.find((record) => record.currentOdometer !== null)?.currentOdometer ?? null;
    const nextForm = { ...emptyForm(), previousOdometer: latestOdometer ? String(latestOdometer) : '' };
    setForm(nextForm);
    setModalOpen(true);
    void loadFormFuelPrices(nextForm.date, true);
  };

  const openEdit = (record: FuelRecord) => {
    setForm(Object.fromEntries(Object.entries(record).map(([key, value]) => [key, value === null ? '' : String(value)])) as FormState);
    setModalOpen(true);
    void loadFormFuelPrices(record.date, false);
  };

  const setField = (field: keyof FormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [field]: value };
      if (field === 'station' || field === 'fuelType') {
        const referencePrice = getStationFuelPrice(fuelPriceData, next.station, next.fuelType);
        next.pricePerLiter = referencePrice ? referencePrice.toFixed(2) : '';
        if (referencePrice && Number(next.total) > 0) next.liters = (Number(next.total) / referencePrice).toFixed(2);
      } else if (field === 'total' && Number(next.pricePerLiter) > 0) {
        next.liters = Number(next.total) > 0 ? (Number(next.total) / Number(next.pricePerLiter)).toFixed(2) : '';
      } else if (field === 'liters' || field === 'pricePerLiter') {
        const calculated = Number(next.liters) * Number(next.pricePerLiter);
        next.total = calculated ? calculated.toFixed(2) : '';
      }
      return next;
    });
  };

  const changeFuelDate = (date: string) => {
    setField('date', date);
    void loadFormFuelPrices(date, true);
  };

  const submitForm = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    const nextRecord: FuelRecord = {
      id: form.id || crypto.randomUUID(), date: form.date, station: form.station.trim(), fuelType: form.fuelType,
      liters: Number(form.liters), pricePerLiter: Number(form.pricePerLiter), total: Number(form.total),
      currentOdometer: form.currentOdometer ? Number(form.currentOdometer) : null,
      previousOdometer: form.previousOdometer ? Number(form.previousOdometer) : null,
      note: form.note.trim(),
    };
    if (nextRecord.currentOdometer !== null && nextRecord.previousOdometer !== null && nextRecord.currentOdometer <= nextRecord.previousOdometer) {
      setToast('เลขไมล์ปัจจุบันต้องมากกว่าเลขไมล์ก่อนหน้า');
      return;
    }
    const next = form.id ? records.map((record) => record.id === form.id ? nextRecord : record) : [nextRecord, ...records];
    try {
      await fuelRepository.save(nextRecord, user.id);
      setRecords(next);
      setModalOpen(false);
      setToast(form.id ? 'แก้ไขและซิงก์เรียบร้อยแล้ว' : 'บันทึกและซิงก์เรียบร้อยแล้ว');
    } catch {
      setToast('บันทึกไม่สำเร็จ กรุณาตรวจการเชื่อมต่อ');
    }
  };

  const removeRecord = async (record: FuelRecord) => {
    if (!window.confirm(`ลบรายการ ${record.station} วันที่ ${dateLabel(record.date)} ใช่ไหม?`)) return;
    try {
      await fuelRepository.remove(record.id);
      setRecords(records.filter((item) => item.id !== record.id));
      setToast('ลบรายการและซิงก์แล้ว');
    } catch {
      setToast('ลบไม่สำเร็จ กรุณาลองใหม่');
    }
  };

  const login = async () => {
    setLoginError('');
    const { error } = await signInWithGoogle();
    if (error) setLoginError('ยังเปิด Google Login ไม่สำเร็จ กรุณาลองอีกครั้งภายหลัง');
  };

  const logout = async () => { await supabase.auth.signOut(); setRecords([]); };

  const goTo = (next: View) => { setView(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (authLoading) return <div className="auth-loading"><span className="brand-mark">F</span><p>กำลังเตรียม Fuelly…</p></div>;
  if (!user) return <LoginScreen onLogin={login} error={loginError} />;

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => goTo('dashboard')}><span className="brand-mark">F</span><span>Fuelly</span></button>
        <nav className="nav-list" aria-label="เมนูหลัก">
          {views.map((item) => <button key={item.id} className={`nav-item ${view === item.id ? 'active' : ''}`} onClick={() => goTo(item.id)}><span>{item.icon}</span>{item.label}</button>)}
          <button className="nav-item" onClick={openAdd}><span>＋</span>บันทึกการเติม</button>
        </nav>
        <div className="sidebar-tip"><span className="tip-icon">♡</span><strong>เคล็ดลับวันนี้</strong><p>เช็กลมยางสม่ำเสมอ ช่วยให้รถวิ่งลื่นและประหยัดน้ำมันขึ้น</p></div>
        <div className="profile"><span className="avatar">{(user.email?.[0] ?? 'F').toUpperCase()}</span><div><strong>{user.user_metadata?.full_name ?? 'บัญชีของฉัน'}</strong><small>{user.email}</small></div><button className="logout-button" onClick={logout} aria-label="ออกจากระบบ">↪</button></div>
      </aside>

      <section className="content">
        <header className="topbar">
          <button className="mobile-brand" onClick={() => goTo('dashboard')}><span className="brand-mark">F</span><b>Fuelly</b></button>
          <div><p className="eyebrow">พื้นที่บันทึกของรถคันโปรด</p><h1>{view === 'dashboard' ? 'สวัสดี! พร้อมออกเดินทางไหม 👋' : views.find((item) => item.id === view)?.label}</h1></div>
          <div className="top-actions"><span className="storage-pill">● ซิงก์กับ Supabase แล้ว</span><button className="add-button" onClick={openAdd}><span>＋</span> บันทึกการเติม</button></div>
        </header>

        {view === 'dashboard' && <>
          <div className="stats-grid">
            <StatCard tone="pink" icon="฿" label="ค่าใช้จ่ายเดือนล่าสุด" value={baht(totalCost)} note={`${costChange <= 0 ? 'ลดลง' : 'เพิ่มขึ้น'} ${Math.abs(costChange).toFixed(1)}% จากเดือนก่อน`} />
            <StatCard tone="lavender" icon="↗" label="ระยะทางรวม" value={`${numberFormat.format(totalDistance)} กม.`} note={`จากการเติม ${currentRecords.length} ครั้ง`} />
            <StatCard tone="mint" icon="◒" label="อัตราการใช้น้ำมันเฉลี่ย" value={measuredLiters ? `${averageEfficiency.toFixed(1)} กม./ลิตร` : '—'} note={`ใช้น้ำมัน ${numberFormat.format(totalLiters)} ลิตร`} />
            <StatCard tone="peach" icon="⌁" label="จำนวนครั้งที่เติมทั้งหมด" value={`${records.length} ครั้ง`} note={`ล่าสุด ${sorted[0] ? dateLabel(sorted[0].date) : '—'}`} />
          </div>
          <FuelPriceBoard />
          <div className="dashboard-grid">
            <article className="panel spending-panel">
              <div className="panel-head"><div><p className="eyebrow">ภาพรวม 6 เดือน</p><h2>ค่าใช้จ่ายน้ำมัน</h2></div><button className="text-button" onClick={() => goTo('analytics')}>ดูการวิเคราะห์ →</button></div>
              <div className="chart-area"><div className="chart-summary"><strong>{baht(sum(monthStats.map((item) => item.cost)))}</strong><span>รวม {monthStats.length} เดือน</span></div><div className="bars">{monthStats.map((item, index) => <div className="bar-wrap" key={item.key}><span className="bar-value">{baht(item.cost)}</span><div className={`bar ${index === monthStats.length - 1 ? 'current' : ''}`} style={{ height: `${Math.max(12, item.cost / chartMax * 100)}%` }} /><small>{monthLabel(item.key)}</small></div>)}</div></div>
            </article>
            <article className="panel efficiency-card">
              <div className="panel-head"><div><p className="eyebrow">ประสิทธิภาพล่าสุด</p><h2>การใช้น้ำมัน</h2></div><span className="good-pill">{sorted[0] && efficiency(sorted[0]) >= 14 ? 'ดีมาก' : 'ปกติ'}</span></div>
              <div className="gauge"><div className="gauge-value"><strong>{sorted[0] ? efficiency(sorted[0]).toFixed(1) : '0.0'}</strong><span>กม./ลิตร</span></div></div>
              <div className="efficiency-stats"><div><span>ต้นทุนต่อกม.</span><strong>{latestMeasuredRecord ? baht(costPerKm(latestMeasuredRecord)) : '—'}</strong></div><div><span>ระยะทางล่าสุด</span><strong>{latestMeasuredRecord ? `${numberFormat.format(distance(latestMeasuredRecord))} กม.` : '—'}</strong></div></div>
            </article>
          </div>
          <article className="panel recent">
            <div className="panel-head"><div><p className="eyebrow">รายการล่าสุด</p><h2>ประวัติการเติมน้ำมัน</h2></div><button className="text-button" onClick={() => goTo('history')}>ดูทั้งหมด →</button></div>
            <RecordList records={sorted.slice(0, 4)} onEdit={openEdit} onDelete={removeRecord} />
          </article>
        </>}

        {view === 'history' && <section className="view-section">
          <div className="section-intro"><div><p>ค้นหา ตรวจสอบ และจัดการรายการที่บันทึกไว้</p></div><div className="result-count">{filteredRecords.length} รายการ</div></div>
          <div className="panel filter-panel"><label className="search-box"><span>⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาปั๊ม ประเภทน้ำมัน หรือหมายเหตุ" /></label><select value={stationFilter} onChange={(event) => setStationFilter(event.target.value)} aria-label="กรองตามปั๊ม"><option value="all">ทุกปั๊ม</option>{[...new Set(records.map((record) => record.station))].sort().map((station) => <option key={station}>{station}</option>)}</select><select value={monthFilter} onChange={(event) => setMonthFilter(event.target.value)} aria-label="กรองตามเดือน"><option value="all">ทุกเดือน</option>{months.map((key) => <option value={key} key={key}>{monthLabel(key, 'long')}</option>)}</select></div>
          <article className="panel history-full"><RecordList records={filteredRecords} onEdit={openEdit} onDelete={removeRecord} empty="ไม่พบรายการที่ตรงกับตัวกรอง" /></article>
        </section>}

        {view === 'analytics' && <section className="view-section analytics-grid">
          <article className="panel analytics-wide"><div className="panel-head"><div><p className="eyebrow">แนวโน้มรายเดือน</p><h2>ค่าใช้จ่ายและระยะทาง</h2></div><span className="legend"><i /> ค่าใช้จ่าย</span></div><div className="analytics-chart">{monthStats.map((item) => <div className="analytics-column" key={item.key}><span>{baht(item.cost)}</span><div className="analytics-track"><div style={{ height: `${Math.max(8, item.cost / chartMax * 100)}%` }} /></div><strong>{monthLabel(item.key)}</strong><small>{numberFormat.format(item.distance)} กม.</small></div>)}</div></article>
          <article className="panel insight-card mint-wash"><p className="eyebrow">ประสิทธิภาพเฉลี่ย</p><strong className="big-number">{(sum(monthStats.map((item) => item.distance)) / Math.max(sum(monthStats.map((item) => item.liters)), 1)).toFixed(1)}</strong><span>กม./ลิตร</span><p>เดือนที่ประหยัดที่สุดคือ <b>{[...monthStats].sort((a,b) => b.efficiency-a.efficiency)[0] ? monthLabel([...monthStats].sort((a,b) => b.efficiency-a.efficiency)[0].key, 'long') : '—'}</b></p></article>
          <article className="panel insight-card peach-wash"><p className="eyebrow">ต้นทุนเฉลี่ย</p><strong className="big-number">{baht(sum(records.map((record) => record.total)) / Math.max(sum(records.map(distance)), 1))}</strong><span>ต่อกิโลเมตร</span><p>รวมระยะทางที่บันทึก <b>{numberFormat.format(sum(records.map(distance)))} กม.</b></p></article>
          <article className="panel analytics-wide"><div className="panel-head"><div><p className="eyebrow">ประสิทธิภาพแต่ละครั้ง</p><h2>กิโลเมตรต่อลิตร</h2></div><span className="goal-chip">เป้าหมาย 16 กม./ลิตร</span></div><div className="efficiency-row-chart">{sorted.slice(0, 8).reverse().map((record) => <div className="eff-bar-item" key={record.id}><div className="eff-bar-track"><div style={{ width: `${Math.min(100, efficiency(record) / 18 * 100)}%` }} /></div><strong>{efficiency(record).toFixed(1)}</strong><span>{dateLabel(record.date)}</span></div>)}</div></article>
        </section>}

        {view === 'report' && <section className="view-section">
          <div className="report-toolbar"><div><p>สรุปข้อมูลแบบรายเดือน พร้อมรายละเอียดทุกการเติม</p></div><select value={selectedReportMonth} onChange={(event) => setReportMonth(event.target.value)}>{months.map((key) => <option value={key} key={key}>{monthLabel(key, 'long')}</option>)}</select></div>
          <article className="report-sheet panel">
            <div className="report-heading"><div><span className="brand-mark">F</span><div><h2>Fuelly Monthly Report</h2><p>{monthLabel(selectedReportMonth, 'long')} • Honda City กข 1234</p></div></div><button className="outline-button" onClick={() => window.print()}>พิมพ์ / บันทึก PDF</button></div>
            <div className="report-stats"><div><span>ค่าใช้จ่ายรวม</span><strong>{baht(reportCost)}</strong></div><div><span>ระยะทางรวม</span><strong>{numberFormat.format(reportDistance)} กม.</strong></div><div><span>น้ำมันรวม</span><strong>{numberFormat.format(reportLiters)} ลิตร</strong></div><div><span>ประสิทธิภาพ</span><strong>{measuredReportLiters ? `${reportEfficiency.toFixed(1)} กม./ลิตร` : '—'}</strong></div></div>
            <div className="report-table-wrap"><table><thead><tr><th>วันที่</th><th>ปั๊ม / น้ำมัน</th><th>ระยะทาง</th><th>ลิตร</th><th>กม./ลิตร</th><th>ยอดรวม</th></tr></thead><tbody>{reportRecords.map((record) => <tr key={record.id}><td>{dateLabel(record.date)}</td><td><b>{record.station}</b><small>{record.fuelType}</small></td><td>{distance(record) > 0 ? `${numberFormat.format(distance(record))} กม.` : '—'}</td><td>{numberFormat.format(record.liters)}</td><td>{distance(record) > 0 ? efficiency(record).toFixed(1) : '—'}</td><td><b>{baht(record.total)}</b></td></tr>)}</tbody></table>{!reportRecords.length && <div className="empty-state">ยังไม่มีข้อมูลในเดือนนี้</div>}</div>
          </article>
        </section>}
      </section>

      {dataLoading && <div className="sync-overlay"><span className="sync-spinner" /><p>กำลังซิงก์ประวัติของคุณ…</p></div>}

      <nav className="bottom-nav" aria-label="เมนูมือถือ">{views.slice(0, 2).map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => goTo(item.id)}><span>{item.icon}</span>{item.short}</button>)}<button className="mobile-add" onClick={openAdd} aria-label="บันทึกการเติม">＋</button>{views.slice(2).map((item) => <button key={item.id} className={view === item.id ? 'active' : ''} onClick={() => goTo(item.id)}><span>{item.icon}</span>{item.short}</button>)}</nav>

      {modalOpen && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setModalOpen(false)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="form-title"><div className="modal-head"><div><p className="eyebrow">{form.id ? 'แก้ไขข้อมูล' : 'เพิ่มรายการใหม่'}</p><h2 id="form-title">บันทึกการเติมน้ำมัน</h2></div><button className="close-button" onClick={() => setModalOpen(false)} aria-label="ปิด">×</button></div><form onSubmit={submitForm} className="fuel-form">
        <label><span>วันที่เติม</span><input type="date" required max={bangkokDateKey()} value={form.date} onChange={(event) => changeFuelDate(event.target.value)} /></label>
        <label><span>ปั๊มน้ำมัน</span><select required value={form.station} onChange={(event) => setField('station', event.target.value)}><option value="">เลือกปั๊มน้ำมัน</option>{stationOptions.map((station) => <option value={station} key={station}>{station}</option>)}</select></label>
        <label><span>ประเภทน้ำมัน</span><select value={form.fuelType} onChange={(event) => setField('fuelType', event.target.value)}>{fuelTypeOptions.map((fuel) => <option value={fuel.value} key={fuel.id}>{fuel.label}</option>)}</select></label>
        <label><span>ราคารวม (บาท)</span><input type="number" min="0.01" step="0.01" required placeholder="เช่น 500" value={form.total} onChange={(event) => setField('total', event.target.value)} /><small>กรอกยอดที่ชำระ แล้วระบบจะคำนวณลิตรให้</small></label>
        <label><span>ราคาต่อลิตร (บาท)</span><input type="number" min="0.01" step="0.01" required placeholder={fuelPriceLoading ? 'กำลังค้นหาราคา…' : '0.00'} value={form.pricePerLiter} readOnly={selectedReferencePrice !== null} onChange={(event) => setField('pricePerLiter', event.target.value)} /><small>{fuelPriceLoading ? 'กำลังค้นหาราคาตามวันที่เลือก' : selectedReferencePrice !== null && priceLookupStatus === 'history' ? `ราคาที่บันทึกไว้ประจำวันที่ ${dateLabel(form.date)}` : selectedReferencePrice !== null ? `ราคาล่าสุดจาก ${fuelPriceData?.source}` : priceLookupStatus === 'missing' ? 'ยังไม่มีราคาย้อนหลังของวันนี้ กรุณากรอกจากใบเสร็จ' : priceLookupStatus === 'error' ? 'ค้นหาราคาไม่สำเร็จ สามารถกรอกจากใบเสร็จได้' : 'ไม่มีราคาสำหรับตัวเลือกนี้ สามารถกรอกเองได้'}</small></label>
        <label><span>ปริมาณ (ลิตร)</span><input type="number" min="0.01" step="0.01" required placeholder="0.00" value={form.liters} readOnly={selectedReferencePrice !== null && Number(form.total) > 0} onChange={(event) => setField('liters', event.target.value)} /><small>{selectedReferencePrice !== null && Number(form.total) > 0 ? 'คำนวณอัตโนมัติจากยอดรวม ÷ ราคาต่อลิตร' : 'กรอกเองได้เมื่อยังไม่มีราคาหรือยอดรวม'}</small></label>
        <label><span>เลขไมล์ก่อนหน้า <em>(ไม่บังคับ)</em></span><input type="number" min="0" step="1" value={form.previousOdometer} onChange={(event) => setField('previousOdometer', event.target.value)} /></label>
        <label><span>เลขไมล์ปัจจุบัน <em>(ไม่บังคับ)</em></span><input type="number" min="0" step="1" value={form.currentOdometer} onChange={(event) => setField('currentOdometer', event.target.value)} /><small>กรอกเลขไมล์ทั้งสองช่อง เมื่อต้องการดู กม./ลิตร</small></label>
        <div className="live-calculation"><div><span>ระยะทาง</span><strong>{Math.max(0, Number(form.currentOdometer) - Number(form.previousOdometer)) || '—'} กม.</strong></div><div><span>ประสิทธิภาพ</span><strong>{Number(form.liters) && Number(form.currentOdometer) > Number(form.previousOdometer) ? ((Number(form.currentOdometer)-Number(form.previousOdometer))/Number(form.liters)).toFixed(1) : '—'} กม./ลิตร</strong></div><div><span>ต้นทุน</span><strong>{Number(form.total) && Number(form.currentOdometer) > Number(form.previousOdometer) ? baht(Number(form.total)/(Number(form.currentOdometer)-Number(form.previousOdometer))) : '—'} /กม.</strong></div></div>
        <label className="full-field"><span>หมายเหตุ</span><textarea rows={3} placeholder="รายละเอียดเพิ่มเติม (ถ้ามี)" value={form.note} onChange={(event) => setField('note', event.target.value)} /></label>
        <div className="form-actions"><button type="button" className="outline-button" onClick={() => setModalOpen(false)}>ยกเลิก</button><button type="submit" className="add-button">{form.id ? 'บันทึกการแก้ไข' : 'เพิ่มรายการ'}</button></div>
      </form></section></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}

function LoginScreen({ onLogin, error }: { onLogin: () => void; error: string }) {
  return <main className="login-page">
    <section className="login-copy">
      <div className="login-brand"><span className="brand-mark">F</span><strong>Fuelly</strong></div>
      <p className="login-kicker">YOUR FUEL COMPANION</p>
      <h1>ทุกการเดินทาง<br />เริ่มจากการเข้าใจรถ</h1>
      <p>บันทึกค่าใช้จ่าย ดูประสิทธิภาพ และเรียกดูประวัติได้ครบทุกอุปกรณ์</p>
      <div className="login-benefits"><span>✓ ซิงก์อัตโนมัติ</span><span>✓ ข้อมูลเป็นส่วนตัว</span><span>✓ ไม่ต้องจำรหัสผ่าน</span></div>
    </section>
    <section className="login-card">
      <div className="login-orbit"><span>F</span></div>
      <p className="eyebrow">ยินดีต้อนรับกลับ</p>
      <h2>เข้าสู่ระบบ Fuelly</h2>
      <p>ใช้บัญชี Google เพื่อให้ประวัติการเติมน้ำมันตามคุณไปทุกอุปกรณ์</p>
      <button className="google-button" onClick={onLogin}><span className="google-mark">G</span>ดำเนินการต่อด้วย Google</button>
      {error && <p className="login-error" role="alert">{error}</p>}
      <small>เราจะใช้เฉพาะอีเมลและชื่อสำหรับระบุตัวตน ข้อมูลน้ำมันของคุณจะไม่ถูกเปิดเผยต่อผู้ใช้อื่น</small>
      <a className="privacy-link" href="/privacy">นโยบายความเป็นส่วนตัว</a>
    </section>
  </main>;
}

function RecordList({ records, onEdit, onDelete, empty = 'ยังไม่มีประวัติการเติม' }: { records: FuelRecord[]; onEdit: (record: FuelRecord) => void; onDelete: (record: FuelRecord) => void; empty?: string }) {
  if (!records.length) return <div className="empty-state">{empty}</div>;
  return <div className="history-list">{records.map((record) => <div className="history-row" key={record.id}><div className="date-box"><strong>{new Date(`${record.date}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('th-TH', { month: 'short' }).format(new Date(`${record.date}T12:00:00`))}</span></div><div className="station"><strong>{record.station}</strong><span>{record.fuelType}{record.currentOdometer !== null ? ` • ${numberFormat.format(record.currentOdometer)} กม.` : ''}</span></div><div className="history-meta"><span>ปริมาณ</span><strong>{numberFormat.format(record.liters)} ลิตร</strong></div><div className="history-meta"><span>ประสิทธิภาพ</span><strong>{distance(record) > 0 ? `${efficiency(record).toFixed(1)} กม./ลิตร` : '—'}</strong></div><strong className="total">{baht(record.total)}</strong><div className="row-actions"><button onClick={() => onEdit(record)} aria-label="แก้ไข">✎</button><button onClick={() => onDelete(record)} aria-label="ลบ">×</button></div></div>)}</div>;
}
