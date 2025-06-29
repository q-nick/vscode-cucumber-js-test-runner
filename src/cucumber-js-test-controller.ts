import path from 'node:path';

import * as vscode from 'vscode';

import { CucumberRunner, CucumberRunnerEvent } from './cucumber-runner';
import { CucumberRunnerEventHandler } from './cucumber-runner-event-handler';
import { CucumberTestRun } from './cucumber-test-run';
import { TestTreeManager } from './test-tree-manager';
import { GherkinDocument, Pickle } from './zod-schemas';
import { buildTestHierarchy, buildTestHierarchyFromPickles } from './test-hierarchy-builder';

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
        // await this.discoverTests();
        await this.discoverTestsFromPickles();
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
    // eslint-disable-next-line unicorn/no-array-for-each
    item.children.forEach((child) => this.collectTests(child, result));
    return result;
  }

  private buildCucumberArgs(request: vscode.TestRunRequest): string[] {
    const arguments_: string[] = [];
    if (request.include && request.include.length > 0) {
      for (const test of request.include) {
        if (test.uri) {
          const relativePath = path.relative(this.rootPath, test.uri.fsPath);
          const line = test.range ? `:${test.range.start.line + 1}` : '';
          arguments_.push(`${relativePath}${line}`);
        }
      }
    }
    return arguments_;
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
      for (const item of request.include) {
        this.collectTests(item, testsToRun);
      }
    } else if (this.testTreeManager?.rootTestItem) {
      this.collectTests(this.testTreeManager.rootTestItem, testsToRun);
    }

    for (const test of testsToRun) {
      run.started(test);
    }
    const cucumberTestRun = new CucumberTestRun(testsToRun);

    const eventHandlerInstance = new CucumberRunnerEventHandler(cucumberTestRun, run, token);

    const arguments_ = this.buildCucumberArgs(request);
    const useTemporaryConfig = arguments_.length > 0;

    await (useTemporaryConfig
      ? this.cucumberRunner.runCucumberWithTmpConfig(arguments_, run, (event) =>
          eventHandlerInstance.handle(event)
        )
      : this.cucumberRunner.runCucumber(arguments_, run, (event) =>
          eventHandlerInstance.handle(event)
        ));
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

  public async discoverTestsFromPickles(): Promise<void> {
    const pickles: Pickle[] = [];
    const gherkinDocuments: GherkinDocument[] = [];
    await this.cucumberRunner?.runCucumber(
      ['--dry-run'],
      undefined,
      (event: CucumberRunnerEvent) => {
        if (event && event.type === 'pickle') {
          pickles.push(event.data);
        }
        if (event && event.type === 'gherkinDocument') {
          gherkinDocuments.push(event.data);
        }
      }
    );

    const hierarchy = buildTestHierarchyFromPickles(pickles, gherkinDocuments);
    this.testTreeManager?.updateTestItemsFromHierarchy(hierarchy);
  }
}
