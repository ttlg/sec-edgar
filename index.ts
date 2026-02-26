#!/usr/bin/env bun
import { Command } from "commander"
import { makeFilingsCommand } from "./src/commands/filings"
import { makeInfoCommand } from "./src/commands/info"
import { makeInsidersCommand } from "./src/commands/insiders"
import { makeSearchCommand } from "./src/commands/search"
import { makeSnapshotCommand } from "./src/commands/snapshot"
import { warmTickerCache } from "./src/lib/sec-api"

void warmTickerCache()

const program = new Command()
  .name("sec-edgar")
  .description("SEC EDGAR API CLI for corporate disclosure data")
  .version("0.1.0")

program.addCommand(makeFilingsCommand())
program.addCommand(makeSearchCommand())
program.addCommand(makeInfoCommand())
program.addCommand(makeInsidersCommand())
program.addCommand(makeSnapshotCommand())

program.parse()
