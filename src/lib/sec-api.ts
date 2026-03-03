const SEC_USER_AGENT = "agiinc contact@agiinc.com"
const DATA_BASE = "https://data.sec.gov"
const EFTS_BASE = "https://efts.sec.gov"
const SEC_BASE = "https://www.sec.gov"

type QueryValue = string | number | boolean | undefined

type CompanyTickerEntry = {
  cik_str: number
  ticker: string
  title: string
}

export type TickerRecord = {
  ticker: string
  company: string
  cik: string
}

type CompanyTickersResponse = Record<string, CompanyTickerEntry>

type RecentFilings = {
  form: string[]
  filingDate: string[]
  accessionNumber: string[]
  primaryDocument: string[]
  primaryDocDescription: string[]
}

type SubmissionsResponse = {
  name: string
  cik: string
  sic?: string
  sicDescription?: string
  website?: string
  fiscalYearEnd?: string
  tickers?: string[]
  filings: {
    recent: RecentFilings
  }
}

type SearchHitSource = {
  file_date?: string
  form?: string
  root_forms?: string[]
  display_names?: string[]
}

type SearchHit = {
  _source?: SearchHitSource
}

type SearchResponse = {
  hits?: {
    hits?: SearchHit[]
  }
}

type FilingIndexResponse = {
  directory?: {
    item?: Array<{ name?: string }>
  }
}

export type FilingRow = {
  date: string
  form: string
  description: string
  accessionNumber: string
  primaryDocument: string
}

export type SearchRow = {
  date: string
  ticker: string
  company: string
  form: string
  cik: string
}

export type CompanyInfo = {
  name: string
  cik: string
  ticker: string
  sic: string
  website: string
  fiscalYearEnd: string
}

export type InsiderRow = {
  date: string
  name: string
  title: string
  type: string
  shares: string
}

let tickerMapPromise: Promise<Map<string, TickerRecord>> | null = null

function paddedCik(cik: string | number): string {
  const raw = typeof cik === "number" ? String(cik) : cik
  const digits = raw.replace(/\D/g, "")
  return digits.padStart(10, "0")
}

function cikArchiveSegment(cik: string): string {
  return String(Number.parseInt(cik, 10))
}

function secHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra)
  headers.set("User-Agent", SEC_USER_AGENT)
  headers.set("Accept", "application/json, text/plain, */*")
  return headers
}

function buildQuery(params: Record<string, QueryValue>): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue
    query.set(key, String(value))
  }
  return query.toString()
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, { headers: secHeaders() })
    if (res.status === 429 && attempt < maxRetries) {
      await sleep(1000 * (attempt + 1))
      continue
    }
    return res
  }
  throw new Error(`SEC request failed after ${maxRetries} retries for ${url}`)
}

async function requestJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    throw new Error(`SEC request failed (${res.status}) for ${url}`)
  }

  try {
    return (await res.json()) as T
  } catch {
    throw new Error(`SEC returned non-JSON response for ${url}`)
  }
}

async function requestText(url: string): Promise<string> {
  const res = await fetchWithRetry(url)
  if (!res.ok) {
    throw new Error(`SEC request failed (${res.status}) for ${url}`)
  }
  return res.text()
}

async function loadTickerMap(): Promise<Map<string, TickerRecord>> {
  const url = `${SEC_BASE}/files/company_tickers.json`
  const payload = await requestJson<CompanyTickersResponse>(url)
  const map = new Map<string, TickerRecord>()

  for (const entry of Object.values(payload)) {
    const ticker = entry.ticker.toUpperCase()
    map.set(ticker, {
      ticker,
      company: entry.title,
      cik: paddedCik(entry.cik_str),
    })
  }

  return map
}

export function warmTickerCache(): Promise<Map<string, TickerRecord>> {
  if (!tickerMapPromise) {
    tickerMapPromise = loadTickerMap()
  }
  return tickerMapPromise
}

export async function resolveTicker(ticker: string): Promise<TickerRecord> {
  const map = await warmTickerCache()
  const key = ticker.toUpperCase()
  const row = map.get(key)
  if (!row) {
    throw new Error(`Ticker not found: ${ticker}`)
  }
  return row
}

async function fetchSubmissionsByCik(cik: string): Promise<SubmissionsResponse> {
  const url = `${DATA_BASE}/submissions/CIK${paddedCik(cik)}.json`
  return requestJson<SubmissionsResponse>(url)
}

function normalizeRecentFilings(recent: RecentFilings): FilingRow[] {
  const rows: FilingRow[] = []
  const count = recent.form.length
  for (let i = 0; i < count; i += 1) {
    rows.push({
      date: recent.filingDate[i] ?? "",
      form: recent.form[i] ?? "",
      description: recent.primaryDocDescription[i] || recent.primaryDocument[i] || "",
      accessionNumber: recent.accessionNumber[i] ?? "",
      primaryDocument: recent.primaryDocument[i] ?? "",
    })
  }
  return rows
}

export async function fetchRecentFilings(
  ticker: string,
  opts: { form?: string; limit: number }
): Promise<{ company: string; cik: string; ticker: string; filings: FilingRow[] }> {
  const tickerRow = await resolveTicker(ticker)
  const submission = await fetchSubmissionsByCik(tickerRow.cik)
  const rows = normalizeRecentFilings(submission.filings.recent)
  const form = opts.form?.toUpperCase()

  const filtered = form ? rows.filter((row) => row.form.toUpperCase() === form) : rows

  return {
    company: submission.name || tickerRow.company,
    cik: paddedCik(submission.cik || tickerRow.cik),
    ticker: tickerRow.ticker,
    filings: filtered.slice(0, opts.limit),
  }
}

function parseDisplayName(display: string): { company: string; ticker: string; cik: string } {
  const infoMatch = display.match(/\(([A-Z.\-]{1,12})\)\s*\(CIK\s*(\d{1,10})\)/)
  const company = display.replace(/\s*\([A-Z.\-]{1,12}\)\s*\(CIK\s*\d{1,10}\)\s*$/, "").trim()

  if (!infoMatch) {
    return {
      company: company || display,
      ticker: "",
      cik: "",
    }
  }

  return {
    company: company || display,
    ticker: infoMatch[1] ?? "",
    cik: paddedCik(infoMatch[2] ?? ""),
  }
}

export async function searchFilings(params: {
  keyword: string
  form?: string
  startDate: string
  endDate: string
  limit: number
}): Promise<SearchRow[]> {
  const query = buildQuery({
    q: params.keyword,
    forms: params.form,
    dateRange: "custom",
    startdt: params.startDate,
    enddt: params.endDate,
  })

  const url = `${EFTS_BASE}/LATEST/search-index?${query}`
  const response = await requestJson<SearchResponse>(url)

  const hits = response.hits?.hits ?? []
  const rows: SearchRow[] = []

  for (const hit of hits) {
    const source = hit._source
    if (!source) continue

    const display = source.display_names?.[0] ?? ""
    const parsed = parseDisplayName(display)
    const form = source.form ?? source.root_forms?.[0] ?? ""

    rows.push({
      date: source.file_date ?? "",
      ticker: parsed.ticker,
      company: parsed.company,
      form,
      cik: parsed.cik,
    })

    if (rows.length >= params.limit) break
  }

  return rows
}

function normalizeFiscalYearEnd(value?: string): string {
  if (!value || value.length !== 4) return "N/A"
  return `${value.slice(0, 2)}/${value.slice(2, 4)}`
}

export async function fetchCompanyInfo(ticker: string): Promise<CompanyInfo> {
  const tickerRow = await resolveTicker(ticker)
  const submission = await fetchSubmissionsByCik(tickerRow.cik)

  const sicCode = submission.sic ?? ""
  const sicDesc = submission.sicDescription ?? ""
  const sic = sicCode && sicDesc ? `${sicCode} - ${sicDesc}` : sicCode || sicDesc || "N/A"

  return {
    name: submission.name || tickerRow.company,
    cik: paddedCik(submission.cik || tickerRow.cik),
    ticker: tickerRow.ticker,
    sic,
    website: submission.website || "N/A",
    fiscalYearEnd: normalizeFiscalYearEnd(submission.fiscalYearEnd),
  }
}

function cleanXmlValue(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

function firstTagValue(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i")
  const match = xml.match(re)
  if (!match?.[1]) return ""
  return cleanXmlValue(match[1])
}

function allBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "gi")
  const blocks: string[] = []
  for (const match of xml.matchAll(re)) {
    if (match[1]) blocks.push(match[1])
  }
  return blocks
}

function reportingOwnerTitle(ownerXml: string): string {
  const relationship = firstTagValue(ownerXml, "reportingOwnerRelationship")
  const officerTitle = firstTagValue(relationship, "officerTitle")
  if (officerTitle) return officerTitle

  const isDirector = firstTagValue(relationship, "isDirector") === "1"
  if (isDirector) return "Director"

  const isTenPercentOwner = firstTagValue(relationship, "isTenPercentOwner") === "1"
  if (isTenPercentOwner) return "10% Owner"

  const isOther = firstTagValue(relationship, "isOther") === "1"
  if (isOther) return "Other"

  return "Officer/Insider"
}

function parseTransactions(xml: string): Array<{ date: string; type: string; shares: string }> {
  const blocks = [
    ...allBlocks(xml, "nonDerivativeTransaction"),
    ...allBlocks(xml, "derivativeTransaction"),
  ]

  return blocks.map((block) => {
    const dateBlock = firstTagValue(block, "transactionDate")
    const date = firstTagValue(dateBlock, "value")

    const sharesBlock = firstTagValue(block, "transactionShares")
    const shares = firstTagValue(sharesBlock, "value")

    const coding = firstTagValue(block, "transactionCoding")
    const code = firstTagValue(coding, "transactionCode")

    const adBlock = firstTagValue(block, "transactionAcquiredDisposedCode")
    const adCode = firstTagValue(adBlock, "value")

    return {
      date,
      type: code || adCode || "",
      shares: shares || "",
    }
  })
}

async function fetchForm4Xml(cik: string, accessionNumber: string): Promise<string> {
  const accessionNoDashes = accessionNumber.replace(/-/g, "")
  const baseUrl = `${SEC_BASE}/Archives/edgar/data/${cikArchiveSegment(cik)}/${accessionNoDashes}`
  const indexUrl = `${baseUrl}/index.json`

  const index = await requestJson<FilingIndexResponse>(indexUrl)
  const items = index.directory?.item ?? []
  const xmlName = items
    .map((item) => item.name)
    .filter((name): name is string => typeof name === "string")
    .find((name) => name.endsWith(".xml") && !name.includes("xsl"))

  if (!xmlName) {
    throw new Error(`Form 4 XML not found for accession ${accessionNumber}`)
  }

  return requestText(`${baseUrl}/${xmlName}`)
}

function parseForm4Xml(xml: string, fallbackDate: string): InsiderRow[] {
  const ownerBlocks = allBlocks(xml, "reportingOwner")
  const owners = ownerBlocks.map((ownerXml) => ({
    name: firstTagValue(ownerXml, "rptOwnerName") || "Unknown",
    title: reportingOwnerTitle(ownerXml),
  }))

  const owner = owners[0] ?? { name: "Unknown", title: "Officer/Insider" }
  const transactions = parseTransactions(xml)

  if (transactions.length === 0) {
    return []
  }

  return transactions.map((tx) => ({
    date: tx.date || fallbackDate,
    name: owner.name,
    title: owner.title,
    type: tx.type || "N/A",
    shares: tx.shares || "N/A",
  }))
}

export async function fetchInsiderTrades(ticker: string, limit: number): Promise<InsiderRow[]> {
  const { cik, filings } = await fetchRecentFilings(ticker, {
    form: "4",
    limit: Math.max(limit * 3, 20),
  })

  const candidates = filings.filter((filing) => filing.accessionNumber).slice(0, Math.max(limit * 3, 20))

  const parsed: InsiderRow[][] = []
  for (const filing of candidates) {
    try {
      const xml = await fetchForm4Xml(cik, filing.accessionNumber)
      parsed.push(parseForm4Xml(xml, filing.date))
    } catch {
      parsed.push([])
    }
  }

  const deduped = Array.from(
    new Map(
      parsed
        .flat()
        .map((row) => [`${row.date}|${row.name}|${row.title}|${row.type}|${row.shares}`, row] as const)
    ).values()
  )

  deduped.sort((a, b) => b.date.localeCompare(a.date))
  return deduped.slice(0, limit)
}

export const SNAPSHOT_TICKERS = [
  "AAPL",
  "MSFT",
  "NVDA",
  "AMZN",
  "GOOGL",
  "META",
  "TSLA",
  "JPM",
  "GS",
] as const
