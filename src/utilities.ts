import * as vscode from 'vscode';

// Kanał logów dla pluginu
const outputChannel = vscode.window.createOutputChannel('Cucumber JS Test Runner');

export function safeJsonParse(string_: string): object | undefined {
  try {
    return JSON.parse(string_);
  } catch {
    return undefined;
  }
}

/**
 * Zamienia timestamp w formacie { seconds, nanos } na milisekundy
 */
export function timestampToMilliseconds(timestamp: { seconds: number; nanos: number }): number {
  return timestamp.seconds * 1000 + Math.floor(timestamp.nanos / 1_000_000);
}

export function logDevelopment(message?: unknown, ...optionalParameters: unknown[]): void {
  console.log(message, ...optionalParameters);
}

export function logChannel(message: string): void {
  outputChannel.appendLine(message);
}

export function logRun(message: string, run: vscode.TestRun | undefined): void {
  if (run) {
    run.appendOutput(message + '\r\n');
  }
}
