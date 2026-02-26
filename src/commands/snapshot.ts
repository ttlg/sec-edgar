import { Command } from "commander"
import { minusDaysIsoDate, todayIsoDate } from "../lib/date"
import { runOrFail } from "../lib/errors"
import { SNAPSHOT_TICKERS, fetchRecentFilings } from "../lib/sec-api"

type SnapshotRow = {
  date: string
  ticker: string
  company: string
  form: string
  description: string
}

export function makeSnapshotCommand(): Command {
  return new Command("snapshot")
    .description("Fetch latest 8-K filings for core World Model Investment tickers")
    .action(async () => {
      await runOrFail(async () => {
        const end = todayIsoDate()
        const start = minusDaysIsoDate(6)

        const all = await Promise.all(
          SNAPSHOT_TICKERS.map(async (ticker) => {
            const { company, filings } = await fetchRecentFilings(ticker, {
              form: "8-K",
              limit: 50,
            })

            return filings
              .filter((row) => row.date >= start && row.date <= end)
              .map<SnapshotRow>((row) => ({
                date: row.date,
                ticker,
                company,
                form: row.form,
                description: row.description,
              }))
          })
        )

        const filings = all
          .flat()
          .sort((a, b) => (a.date === b.date ? a.ticker.localeCompare(b.ticker) : b.date.localeCompare(a.date)))

        console.log(
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              filings,
            },
            null,
            2
          )
        )
      })
    })
}
