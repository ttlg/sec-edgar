export function printTable(headers: string[], rows: string[][]): void {
  if (rows.length === 0) {
    console.log("(no results)")
    return
  }

  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]?.length ?? 0))
  )

  const headerRow = headers
    .map((header, i) => header.padEnd(widths[i] ?? header.length))
    .join("  ")
  const separator = widths.map((width) => "-".repeat(width)).join("  ")

  console.log(headerRow)
  console.log(separator)
  for (const row of rows) {
    console.log(
      row
        .map((cell, i) => cell.padEnd(widths[i] ?? cell.length))
        .join("  ")
    )
  }
}

export function printDetail(fields: Array<[string, string]>): void {
  const maxLabel = Math.max(...fields.map(([label]) => label.length))
  for (const [label, value] of fields) {
    console.log(`${label.padEnd(maxLabel)}  ${value}`)
  }
}
