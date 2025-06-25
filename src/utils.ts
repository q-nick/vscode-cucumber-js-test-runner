// Najprostszy dekorator do logowania czasu
export function logTime(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    console.log(`🚀 Starting: ${propertyKey}`);

    try {
      const result = await originalMethod.apply(this, args);
      const duration = (Date.now() - start) / 1000;
      console.log(`✅ ${propertyKey} completed in ${duration.toFixed(2)}s`);
      return result;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      console.log(`❌ ${propertyKey} failed after ${duration.toFixed(2)}s`);
      throw error;
    }
  };

  return descriptor;
}

export function logTestOutput(text: string, run?: import('vscode').TestRun, prefix = ''): void {
  const message = prefix ? `${prefix} ${text}` : text;
  if (run) {
    run.appendOutput(message + '\n');
  }
  console.log(message);
}

export function safeJsonParse(str: string): object | undefined {
  try {
    return JSON.parse(str);
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
