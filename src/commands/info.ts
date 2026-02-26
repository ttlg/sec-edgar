import { Command } from "commander"
import { runOrFail } from "../lib/errors"
import { printDetail } from "../lib/output"
import { fetchCompanyInfo } from "../lib/sec-api"

export function makeInfoCommand(): Command {
  return new Command("info")
    .description("Show company profile for a ticker")
    .argument("<ticker>", "Ticker symbol")
    .action(async (ticker: string) => {
      await runOrFail(async () => {
        const info = await fetchCompanyInfo(ticker)

        printDetail([
          ["Name:", info.name],
          ["CIK:", info.cik],
          ["Ticker:", info.ticker],
          ["SIC:", info.sic],
          ["Website:", info.website],
          ["FY End:", info.fiscalYearEnd],
        ])
      })
    })
}
