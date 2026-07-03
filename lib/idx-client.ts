/**
 * Klien untuk endpoint publik tidak resmi idx.co.id.
 *
 * CATATAN PENTING: endpoint ini TIDAK didokumentasikan resmi oleh IDX, dilindungi
 * proteksi anti-bot sederhana (butuh session cookie dari homepage sebelum hit
 * /primary/...), dan strukturnya bisa berubah/gagal tanpa pemberitahuan sewaktu-waktu.
 * Endpoint & field di bawah ini diverifikasi manual pada 2026-06-21.
 *
 * - GetBrokerSummary: rekap transaksi per broker per hari
 * - DigitalStatistic/GetApiData (urlName=LINK_TABLE_DAILY_TRADING_INVESTOR_FOREIGN/DOMESTIC):
 *   matriks transaksi harian silang Foreign<->Domestic per bulan. Untuk dapat
 *   total buy/sell per investorType, kedua tabel (foreign & domestic) harus
 *   digabung per tanggal — lihat computeInvestorFlow().
 */

const BROWSER_HEADERS: Record<string, string> = {
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',
  Referer: 'https://www.idx.co.id/',
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
}

let sessionCookie: string | null = null

async function ensureSession(): Promise<void> {
  if (sessionCookie) return
  const res = await fetch('https://www.idx.co.id/id', { headers: BROWSER_HEADERS })
  const cookies = (res.headers as any).getSetCookie?.() as string[] | undefined
  const raw = cookies && cookies.length > 0 ? cookies : [res.headers.get('set-cookie') ?? '']
  sessionCookie = raw.filter(Boolean).map(c => c.split(';')[0]).join('; ')
}

async function idxFetch(url: string, attempt = 1): Promise<Response> {
  await ensureSession()
  const res = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
  })
  if ((res.status === 403 || res.status >= 500) && attempt < 3) {
    sessionCookie = null
    await new Promise(r => setTimeout(r, 1000 * attempt))
    return idxFetch(url, attempt + 1)
  }
  return res
}

/** Format Date/string ke YYYYMMDD sesuai param `date` yang diharapkan endpoint IDX. */
export function toIdxDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

// ───────────────────────── Stock Summary (harian, per saham) ─────────────────────────

/**
 * GetStockSummary menyediakan ForeignBuy/ForeignSell PER SAHAM (dalam volume lembar),
 * berbeda dengan GetBrokerSummary yang market-wide. Diverifikasi manual 2026-06-21,
 * contoh AADI: Volume=59395900, ForeignSell=57181500, ForeignBuy=43964900.
 * Catatan: ini volume, bukan value — estimasi value harus dihitung manual (volume × close).
 *
 * PENTING: ForeignBuy/ForeignSell turut mencakup transaksi non-reguler (negosiasi/block
 * trade) yang harganya bisa sangat berbeda dari Close — untuk saham dengan nonRegularVolume
 * besar relatif terhadap volume, estimasi (volume × close) jadi tidak bisa diandalkan.
 * Contoh nyata GOTO 2026-06-19: nonRegularVolume (1.28 miliar) > volume reguler (1.265 miliar).
 */
export interface StockSummaryItem {
  date: string // YYYY-MM-DD
  stockCode: string
  stockName: string
  close: number
  volume: number
  value: number
  frequency: number
  foreignBuy: number
  foreignSell: number
  nonRegularVolume: number
}

interface RawStockSummaryItem {
  Date: string
  StockCode: string
  StockName: string
  Close: number
  Volume: number
  Value: number
  Frequency: number
  ForeignBuy: number
  ForeignSell: number
  NonRegularVolume: number
}

/** @param date format YYYYMMDD */
export async function getStockSummary(date: string): Promise<StockSummaryItem[]> {
  const url = `https://www.idx.co.id/primary/TradingSummary/GetStockSummary?length=9999&start=0&date=${date}`
  const res = await idxFetch(url)
  if (!res.ok) throw new Error(`IDX GetStockSummary gagal: HTTP ${res.status}`)
  const json = await res.json()
  const data: RawStockSummaryItem[] = Array.isArray(json?.data) ? json.data : []
  return data.map(item => ({
    date: String(item.Date).slice(0, 10),
    stockCode: String(item.StockCode),
    stockName: String(item.StockName ?? ''),
    close: Number(item.Close ?? 0),
    volume: Number(item.Volume ?? 0),
    value: Number(item.Value ?? 0),
    frequency: Number(item.Frequency ?? 0),
    foreignBuy: Number(item.ForeignBuy ?? 0),
    foreignSell: Number(item.ForeignSell ?? 0),
    nonRegularVolume: Number(item.NonRegularVolume ?? 0),
  }))
}

// ───────────────────────── Broker Summary (harian) ─────────────────────────

export interface BrokerSummaryItem {
  date: string // YYYY-MM-DD
  brokerCode: string
  brokerName: string
  volume: number
  value: number
  frequency: number
}

interface RawBrokerSummaryItem {
  Date: string
  IDFirm: string
  FirmName: string
  Volume: number
  Value: number
  Frequency: number
}

/** @param date format YYYYMMDD */
export async function getBrokerSummary(date: string): Promise<BrokerSummaryItem[]> {
  const url = `https://www.idx.co.id/primary/TradingSummary/GetBrokerSummary?length=9999&start=0&date=${date}`
  const res = await idxFetch(url)
  if (!res.ok) throw new Error(`IDX GetBrokerSummary gagal: HTTP ${res.status}`)
  const json = await res.json()
  const data: RawBrokerSummaryItem[] = Array.isArray(json?.data) ? json.data : []
  return data.map(item => ({
    date: String(item.Date).slice(0, 10),
    brokerCode: String(item.IDFirm),
    brokerName: String(item.FirmName ?? ''),
    volume: Number(item.Volume ?? 0),
    value: Number(item.Value ?? 0),
    frequency: Number(item.Frequency ?? 0),
  }))
}

// ───────────────────────── Foreign/Domestic Flow (bulanan) ─────────────────────────

export type InvestorType = 'FOREIGN' | 'DOMESTIC'

export interface InvestorFlowItem {
  date: string // YYYY-MM-DD
  investorType: InvestorType
  buyVolume: number
  buyValue: number
  buyFrequency: number
  sellVolume: number
  sellValue: number
  sellFrequency: number
}

interface RawForeignRow {
  date: string
  foreignForeignVolume: number; foreignForeignValue: number; foreignForeignFreq: number
  foreignDomesticVolume: number; foreignDomesticValue: number; foreignDomesticFreq: number
}

interface RawDomesticRow {
  date: string
  domesticForeignVolume: number; domesticForeignValue: number; domesticForeignFreq: number
  domesticDomesticVolume: number; domesticDomesticValue: number; domesticDomesticFreq: number
}

function buildMonthlyQuery(year: number, month: number): string {
  const obj = { year: String(year), month: String(month), quarter: 0, type: 'monthly' }
  return Buffer.from(JSON.stringify(obj)).toString('base64')
}

async function fetchForeignTable(year: number, month: number): Promise<RawForeignRow[]> {
  const query = buildMonthlyQuery(year, month)
  const url = `https://www.idx.co.id/primary/DigitalStatistic/GetApiData?urlName=LINK_TABLE_DAILY_TRADING_INVESTOR_FOREIGN&query=${query}&isPrint=False&cumulative=false`
  const res = await idxFetch(url)
  if (!res.ok) throw new Error(`IDX foreign flow gagal: HTTP ${res.status}`)
  const json = await res.json()
  return Array.isArray(json?.data) ? json.data : []
}

async function fetchDomesticTable(year: number, month: number): Promise<RawDomesticRow[]> {
  const query = buildMonthlyQuery(year, month)
  const url = `https://www.idx.co.id/primary/DigitalStatistic/GetApiData?urlName=LINK_TABLE_DAILY_TRADING_INVESTOR_DOMESTIC&query=${query}&isPrint=False&cumulative=false`
  const res = await idxFetch(url)
  if (!res.ok) throw new Error(`IDX domestic flow gagal: HTTP ${res.status}`)
  const json = await res.json()
  return Array.isArray(json?.data) ? json.data : []
}

/** Net flow FOREIGN per hari dalam bulan tertentu. Bulan 1-12. */
export async function getForeignTradingFlow(year: number, month: number): Promise<InvestorFlowItem[]> {
  const [foreignRows, domesticRows] = await Promise.all([
    fetchForeignTable(year, month),
    fetchDomesticTable(year, month),
  ])
  const domesticByDate = new Map(domesticRows.map(r => [r.date, r]))
  return foreignRows.map(f => {
    const d = domesticByDate.get(f.date)
    return {
      date: f.date,
      investorType: 'FOREIGN' as const,
      buyValue: Number(f.foreignForeignValue ?? 0) + Number(d?.domesticForeignValue ?? 0),
      buyVolume: Number(f.foreignForeignVolume ?? 0) + Number(d?.domesticForeignVolume ?? 0),
      buyFrequency: Number(f.foreignForeignFreq ?? 0) + Number(d?.domesticForeignFreq ?? 0),
      sellValue: Number(f.foreignForeignValue ?? 0) + Number(f.foreignDomesticValue ?? 0),
      sellVolume: Number(f.foreignForeignVolume ?? 0) + Number(f.foreignDomesticVolume ?? 0),
      sellFrequency: Number(f.foreignForeignFreq ?? 0) + Number(f.foreignDomesticFreq ?? 0),
    }
  })
}

/** Net flow DOMESTIC per hari dalam bulan tertentu. Bulan 1-12. */
export async function getDomesticTradingFlow(year: number, month: number): Promise<InvestorFlowItem[]> {
  const [foreignRows, domesticRows] = await Promise.all([
    fetchForeignTable(year, month),
    fetchDomesticTable(year, month),
  ])
  const foreignByDate = new Map(foreignRows.map(r => [r.date, r]))
  return domesticRows.map(d => {
    const f = foreignByDate.get(d.date)
    return {
      date: d.date,
      investorType: 'DOMESTIC' as const,
      buyValue: Number(f?.foreignDomesticValue ?? 0) + Number(d.domesticDomesticValue ?? 0),
      buyVolume: Number(f?.foreignDomesticVolume ?? 0) + Number(d.domesticDomesticVolume ?? 0),
      buyFrequency: Number(f?.foreignDomesticFreq ?? 0) + Number(d.domesticDomesticFreq ?? 0),
      sellValue: Number(d.domesticForeignValue ?? 0) + Number(d.domesticDomesticValue ?? 0),
      sellVolume: Number(d.domesticForeignVolume ?? 0) + Number(d.domesticDomesticVolume ?? 0),
      sellFrequency: Number(d.domesticForeignFreq ?? 0) + Number(d.domesticDomesticFreq ?? 0),
    }
  })
}
