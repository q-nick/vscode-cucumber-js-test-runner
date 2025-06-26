import * as vscode from 'vscode';
import * as path from 'path';
import { CucumberRunner, CucumberRunnerEvent } from './CucumberRunner';
import { buildTestHierarchy } from './testHierarchyBuilder';
import { GherkinDocument, TestStepStatus, TestStepFinished } from './zodSchemas';
import { logRun, timestampToMilliseconds } from './utils';
import { TestTreeManager } from './TestTreeManager';
import { CucumberTestRun } from './CucumberTestRun';
import { CucumberRunnerEventHandler } from './CucumberRunnerEventHandler';

export class CucumberJsTestController {
  public readonly vscodeTestController: vscode.TestController;
  private rootPath: string;
  private testTreeManager?: TestTreeManager;
  private cucumberRunner?: CucumberRunner;

  constructor() {
    this.rootPath = '';
    this.vscodeTestController = vscode.tests.createTestController(
      'cucumber-js-test-controller',
      'Cucumber.js Tests'
    );
    this.vscodeTestController.resolveHandler = async (item?: vscode.TestItem) => {
      if (!item) {
        await this.discoverTests();
      }
    };
  }

  public refresh() {}

  public initializeWorkspace(): void {
    this.rootPath = this.getWorkspaceRootPath() || '';
    if (!this.rootPath) {
      this.vscodeTestController.items.replace([]);
      return;
    }
    this.testTreeManager = new TestTreeManager(this.vscodeTestController, this.rootPath);
    this.testTreeManager.createRootTestItem();
    this.cucumberRunner = new CucumberRunner(this.rootPath);
    this.initializeCucumber();
  }

  private getWorkspaceRootPath(): string | undefined {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (workspaceFolders && workspaceFolders.length > 0) {
      return workspaceFolders[0].uri.fsPath;
    }
    return undefined;
  }

  public initializeCucumber(): void {
    if (!this.cucumberRunner) {
      this.cucumberRunner = new CucumberRunner(this.rootPath);
    }
    // this.cucumberRunner.onEvent((event: CucumberRunnerEvent) => {});
  }

  private collectTests(item: vscode.TestItem, result: vscode.TestItem[] = []): vscode.TestItem[] {
    result.push(item);
    item.children.forEach((child) => this.collectTests(child, result));
    return result;
  }

  private buildCucumberArgs(request: vscode.TestRunRequest): string[] {
    const args: string[] = [];
    if (request.include && request.include.length > 0) {
      for (const test of request.include) {
        if (test.uri) {
          const relativePath = path.relative(this.rootPath, test.uri.fsPath);
          const line = test.range ? `:${test.range.start.line + 1}` : '';
          args.push(`${relativePath}${line}`);
        }
      }
    }
    return args;
  }

  public async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (!this.cucumberRunner) {
      throw new Error('CucumberRunner is not initialized. Call initializeWorkspace first.');
    }
    const run = this.vscodeTestController.createTestRun(request);

    // Zbierz testy do uruchomienia
    const testsToRun: vscode.TestItem[] = [];
    if (request.include) {
      request.include.forEach((item) => this.collectTests(item, testsToRun));
    } else if (this.testTreeManager?.rootTestItem) {
      this.collectTests(this.testTreeManager.rootTestItem, testsToRun);
    }

    testsToRun.forEach((test) => run.started(test));
    const cucumberTestRun = new CucumberTestRun(testsToRun);

    const eventHandlerInstance = new CucumberRunnerEventHandler(cucumberTestRun, run, token);

    const args = this.buildCucumberArgs(request);
    const useTmpConfig = args.length > 0;

    if (useTmpConfig) {
      await this.cucumberRunner.runCucumberWithTmpConfig(args, run, eventHandlerInstance.handle);
    } else {
      await this.cucumberRunner.runCucumber(args, run, eventHandlerInstance.handle);
    }
    run.end();
  }

  public async discoverTests(): Promise<void> {
    const gherkinDocuments: GherkinDocument[] = [];
    await this.cucumberRunner?.runCucumber(
      ['--dry-run'],
      undefined,
      (event: CucumberRunnerEvent) => {
        if (event && event.type === 'gherkinDocument') {
          gherkinDocuments.push(event.data);
        }
      }
    );

    const hierarchy = buildTestHierarchy(gherkinDocuments);
    this.testTreeManager?.updateTestItemsFromHierarchy(hierarchy);
  }
}
