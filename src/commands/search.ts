import { Command } from "commander"
import { minusDaysIsoDate, todayIsoDate } from "../lib/date"
import { runOrFail } from "../lib/errors"
import { printTable } from "../lib/output"
import { searchFilings } from "../lib/sec-api"

type SearchOptions = {
  form?: string
  days: string
  limit: string
  json?: boolean
}

export function makeSearchCommand(): Command {
  return new Command("search")
    .description("Search SEC EDGAR filing index")
    .argument("<keyword>", "Keyword")
    .option("--form <type>", "Form type filter (8-K, 10-K, 10-Q, 4, etc)")
    .option("--days <n>", "Look back N days", "30")
    .option("--limit <n>", "Number of matches to return", "10")
    .option("--json", "Output JSON")
    .action(async (keyword: string, opts: SearchOptions) => {
      await runOrFail(async () => {
        const days = Number.parseInt(opts.days, 10)
        const limit = Number.parseInt(opts.limit, 10)

        if (!Number.isInteger(days) || days <= 0) {
          throw new Error("--days must be a positive integer")
        }
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new Error("--limit must be a positive integer")
        }

        const endDate = todayIsoDate()
        const startDate = minusDaysIsoDate(days - 1)
        const rows = await searchFilings({
          keyword,
          form: opts.form,
          startDate,
          endDate,
          limit,
        })

        if (opts.json) {
          console.log(JSON.stringify(rows, null, 2))
          return
        }

        printTable(
          ["date", "ticker", "company", "form"],
          rows.map((row) => [row.date, row.ticker, row.company, row.form])
        )
      })
    })
}
