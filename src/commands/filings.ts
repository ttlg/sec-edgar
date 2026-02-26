import { Command } from "commander"
import { runOrFail } from "../lib/errors"
import { printTable } from "../lib/output"
import { fetchRecentFilings } from "../lib/sec-api"

type FilingsOptions = {
  form?: string
  limit: string
  json?: boolean
}

export function makeFilingsCommand(): Command {
  return new Command("filings")
    .description("Fetch recent SEC filings for a ticker")
    .argument("<ticker>", "Ticker symbol")
    .option("--form <type>", "Filter by form type (8-K, 10-K, 10-Q, 4, 13F-HR, etc)")
    .option("--limit <n>", "Number of filings to return", "10")
    .option("--json", "Output JSON")
    .action(async (ticker: string, opts: FilingsOptions) => {
      await runOrFail(async () => {
        const limit = Number.parseInt(opts.limit, 10)
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new Error("--limit must be a positive integer")
        }

        const result = await fetchRecentFilings(ticker, {
          form: opts.form,
          limit,
        })

        if (opts.json) {
          console.log(JSON.stringify(result, null, 2))
          return
        }

        printTable(
          ["date", "form", "description"],
          result.filings.map((row) => [row.date, row.form, row.description])
        )
      })
    })
}
