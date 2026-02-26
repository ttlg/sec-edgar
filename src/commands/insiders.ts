import { Command } from "commander"
import { runOrFail } from "../lib/errors"
import { printTable } from "../lib/output"
import { fetchInsiderTrades } from "../lib/sec-api"

type InsidersOptions = {
  limit: string
  json?: boolean
}

export function makeInsidersCommand(): Command {
  return new Command("insiders")
    .description("Fetch insider transactions from Form 4")
    .argument("<ticker>", "Ticker symbol")
    .option("--limit <n>", "Number of transactions to return", "10")
    .option("--json", "Output JSON")
    .action(async (ticker: string, opts: InsidersOptions) => {
      await runOrFail(async () => {
        const limit = Number.parseInt(opts.limit, 10)
        if (!Number.isInteger(limit) || limit <= 0) {
          throw new Error("--limit must be a positive integer")
        }

        const rows = await fetchInsiderTrades(ticker, limit)

        if (opts.json) {
          console.log(JSON.stringify(rows, null, 2))
          return
        }

        printTable(
          ["date", "name", "title", "type", "shares"],
          rows.map((row) => [row.date, row.name, row.title, row.type, row.shares])
        )
      })
    })
}
