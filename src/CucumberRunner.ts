import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { safeJsonParse } from './utils';
import { logTestOutput } from './utils';
import * as fs from 'fs';
import * as path from 'path';
import { CucumberEvent, parseCucumberEvent } from './zodSchemas';

export type CucumberRunnerEvent =
  | CucumberEvent
  | { type: 'stderr'; data: string }
  | { type: 'close'; data: number }
  | { type: 'error'; data: Error };

export class CucumberRunner {
  private onEventEmitter = new vscode.EventEmitter<CucumberRunnerEvent>();
  public readonly onEvent = this.onEventEmitter.event;

  constructor(private rootPath: string) {}

  public runCucumber(
    args: string[] = [],
    run?: vscode.TestRun,
    eventCallback?: (event: CucumberRunnerEvent) => void
  ): Promise<number> {
    const fullArgs = [...args, '--format', 'message'];
    return new Promise((resolve, reject) => {
      logTestOutput('cucumber-js ' + fullArgs.join(' '), run, '[run]');
      const cucumberProcess = spawn('npx', ['cucumber-js', ...fullArgs], {
        cwd: this.rootPath,
        shell: true,
      });

      const fireEvent = (event: CucumberRunnerEvent) => {
        if (eventCallback) {
          eventCallback(event);
        }
        this.onEventEmitter.fire(event);
      };

      cucumberProcess.stdout.on('data', (data) => {
        const lines = data.toString().split(/\r?\n/);
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }

          const parsedJson = safeJsonParse(line);
          const cucumberEvent = parseCucumberEvent(parsedJson);

          if (cucumberEvent) {
            logTestOutput(line, run, '[ccevent]');
            fireEvent(cucumberEvent);
          } else {
            logTestOutput(line, run, '[stdout]');
          }
        }
      });

      cucumberProcess.stderr.on('data', (data) => {
        fireEvent({ type: 'stderr', data: data.toString() });
        logTestOutput(data.toString(), run, '[stderr]');
      });

      cucumberProcess.on('close', (code) => {
        fireEvent({ type: 'close', data: code ?? 0 });
        resolve(code ?? 0);
      });

      cucumberProcess.on('error', (err) => {
        fireEvent({ type: 'error', data: err });
        reject(err);
      });
    });
  }

  public async runCucumberWithTmpConfig(
    args: string[] = [],
    run?: vscode.TestRun,
    eventCallback?: (event: CucumberRunnerEvent) => void
  ): Promise<number> {
    const tmpFileName = '.cucumber-js-test-runner-config.js';
    const tmpConfigAbsolutePath = path.join(this.rootPath, tmpFileName);
    if (!fs.existsSync(tmpConfigAbsolutePath)) {
      fs.writeFileSync(tmpConfigAbsolutePath, 'module.exports = {}', 'utf8');
    }

    const fullArgs = [...args, '--config', tmpFileName];
    return this.runCucumber(fullArgs, run, eventCallback);
  }
}

export namespace CucumberRunner {
  export type CucumberRunnerEvent =
    | import('./zodSchemas').CucumberEvent
    | { type: 'stderr'; data: string }
    | { type: 'close'; data: number }
    | { type: 'error'; data: Error };
}
