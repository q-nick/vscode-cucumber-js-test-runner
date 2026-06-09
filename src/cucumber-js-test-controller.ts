import path from 'node:path';

import * as vscode from 'vscode';

import { CucumberRunner, CucumberRunnerEvent } from './cucumber-runner';
import { CucumberRunnerEventHandler } from './cucumber-runner-event-handler';
import { CucumberTestRun } from './cucumber-test-run';
import { buildTestHierarchyFromPickles } from './test-hierarchy-builder';
import { TestTreeManager } from './test-tree-manager';
import { GherkinDocument, Pickle } from './zod-schemas';

export class CucumberJsTestController {
  public readonly vscodeTestController: vscode.TestController;
  private runners = new Map<string, CucumberRunner>();
  private treeManagers = new Map<string, TestTreeManager>();
  public readonly diagnostics = vscode.languages.createDiagnosticCollection('cucumber');

  constructor() {
    this.vscodeTestController = vscode.tests.createTestController(
      'cucumber-js-test-controller',
      'Cucumber.js Tests'
    );
    this.vscodeTestController.resolveHandler = async (item?: vscode.TestItem) => {
      if (!item) {
        await this.discoverTestsFromPickles();
      }
    };
  }

  public refresh() {}

  public initializeWorkspace(): void {
    this.runners.clear();
    this.treeManagers.clear();
    this.vscodeTestController.items.replace([]);

    for (const rootPath of this.getProjectRootPaths()) {
      const treeManager = new TestTreeManager(this.vscodeTestController, rootPath);
      treeManager.createRootTestItem();
      this.treeManagers.set(rootPath, treeManager);
      this.runners.set(rootPath, new CucumberRunner(rootPath));
    }
  }

  private getProjectRootPaths(): string[] {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) return [];

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    const projectRoots = vscode.workspace
      .getConfiguration('cucumberJsTestRunner')
      .get<string[]>('projectRoots', ['.']);

    return projectRoots.map((rel) => path.join(workspaceRoot, rel));
  }

  private collectTests(item: vscode.TestItem, result: vscode.TestItem[] = []): vscode.TestItem[] {
    result.push(item);
    // eslint-disable-next-line unicorn/no-array-for-each
    item.children.forEach((child) => this.collectTests(child, result));
    return result;
  }

  public async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    const run = this.vscodeTestController.createTestRun(request);

    const allTests: vscode.TestItem[] = [];
    if (request.include) {
      for (const item of request.include) this.collectTests(item, allTests);
    } else {
      for (const [, treeManager] of this.treeManagers) {
        if (treeManager.rootTestItem) this.collectTests(treeManager.rootTestItem, allTests);
      }
    }
    for (const test of allTests) run.started(test);

    for (const [rootPath, runner] of this.runners) {
      const rootTests = allTests.filter((t) => t.uri && t.uri.fsPath.startsWith(rootPath));
      if (rootTests.length === 0 && request.include) continue;

      const cucumberTestRun = new CucumberTestRun(rootTests, this.diagnostics);
      const eventHandler = new CucumberRunnerEventHandler(
        cucumberTestRun,
        run,
        token,
        this.diagnostics
      );

      const selectedItems = request.include
        ? request.include.filter((t) => !t.uri || t.uri.fsPath.startsWith(rootPath))
        : [];

      const arguments_: string[] = [];
      for (const test of selectedItems) {
        if (test.uri) {
          const relativePath = path.relative(rootPath, test.uri.fsPath);
          const line = test.range ? `:${test.range.start.line + 1}` : '';
          arguments_.push(`${relativePath}${line}`);
        }
      }

      const useTemporaryConfig = arguments_.length > 0;
      await (useTemporaryConfig
        ? runner.runCucumberWithTmpConfig(arguments_, run, (e) => eventHandler.handle(e))
        : runner.runCucumber(arguments_, run, (e) => eventHandler.handle(e)));
    }

    run.end();
  }

  public async discoverTestsFromPickles(): Promise<void> {
    for (const [rootPath, runner] of this.runners) {
      const pickles: Pickle[] = [];
      const gherkinDocuments: GherkinDocument[] = [];

      await runner.runCucumber(['--dry-run'], undefined, (event: CucumberRunnerEvent) => {
        if (event?.type === 'pickle') pickles.push(event.data);
        if (event?.type === 'gherkinDocument') gherkinDocuments.push(event.data);
      });

      const hierarchy = buildTestHierarchyFromPickles(pickles, gherkinDocuments);
      this.treeManagers.get(rootPath)?.updateTestItemsFromHierarchy(hierarchy);
    }
  }
}
