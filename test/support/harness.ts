export const MNEMONIC =
  "test test test test test test test test test test test junk";
export const PASSWORD = "TestPassword123";
export const EXECUTION_ADDRESS =
  "0x1234567890123456789012345678901234567890";

export async function captureConsole(
  run: () => Promise<void>
): Promise<{ logs: string[]; warnings: string[] }> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const logs: string[] = [];
  const warnings: string[] = [];
  console.log = (...values: unknown[]) => logs.push(values.join(" "));
  console.warn = (...values: unknown[]) => warnings.push(values.join(" "));
  try {
    await run();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
  }
  return { logs, warnings };
}

export async function captureStdout(run: () => Promise<void>): Promise<string> {
  const originalWrite = process.stdout.write;
  let output = "";
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString();
    return true;
  }) as typeof process.stdout.write;
  try {
    await run();
  } finally {
    process.stdout.write = originalWrite;
  }
  return output;
}
