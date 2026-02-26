export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function fail(error: unknown): never {
  console.error(JSON.stringify({ ok: false, error: errorMessage(error) }))
  process.exit(1)
}

export async function runOrFail(fn: () => Promise<void>): Promise<void> {
  try {
    await fn()
  } catch (error) {
    fail(error)
  }
}
