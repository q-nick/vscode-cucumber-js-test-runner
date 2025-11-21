import path from 'node:path';

import type * as vscode from 'vscode';

import { CucumberRunner, CucumberRunnerEvent } from './cucumber-runner';
import { CucumberRunnerEventHandler } from './cucumber-runner-event-handler';
import { CucumberTestRun } from './cucumber-test-run';
import { buildTestHierarchyFromGherkinDocuments } from './test-hierarchy-builder-documents';
import { TestTreeManager } from './test-tree-manager';
import { GherkinDocument, Pickle } from './zod-schemas';

// Interface for dependencies - entire VS Code API object
export interface CucumberJsTestControllerDependencies {
  vscode: typeof vscode;
  workspaceRootPathProvider: () => string | undefined;
}

export class CucumberJsTestController {
  public readonly vscodeTestController: vscode.TestController;
  private rootPath: string;
  public testTreeManager?: TestTreeManager;
  private cucumberRunner?: CucumberRunner;
  public readonly diagnostics: vscode.DiagnosticCollection;
  private workspaceRootPathProvider: () => string | undefined;
  private vscode: typeof vscode;

  constructor(dependencies: CucumberJsTestControllerDependencies) {
    this.rootPath = '';
    this.vscode = dependencies.vscode;
    this.vscodeTestController = this.vscode.tests.createTestController(
      'cucumber-js-test-controller',
      'Cucumber.js Tests'
    );
    this.diagnostics = this.vscode.languages.createDiagnosticCollection('cucumber');
    this.workspaceRootPathProvider = dependencies.workspaceRootPathProvider;

    this.vscodeTestController.resolveHandler = async (item?: vscode.TestItem) => {
      if (!item) {
        await this.discoverTests();
      }
    };
  }

  public refresh() {}

  public initializeWorkspace(): void {
    this.rootPath = this.workspaceRootPathProvider() || '';
    if (!this.rootPath) {
      this.vscodeTestController.items.replace([]);
      return;
    }
    this.testTreeManager = new TestTreeManager(
      this.vscode,
      this.vscodeTestController,
      this.rootPath
    );
    this.testTreeManager.createRootTestItem();
    this.cucumberRunner = new CucumberRunner(this.vscode, this.rootPath);
    this.initializeCucumber();
  }

  public initializeCucumber(): void {
    if (!this.cucumberRunner && this.rootPath) {
      this.cucumberRunner = new CucumberRunner(this.vscode, this.rootPath);
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
    const cucumberTestRun = new CucumberTestRun(testsToRun, this.diagnostics);

    const eventHandlerInstance = new CucumberRunnerEventHandler(
      this.vscode,
      cucumberTestRun,
      run,
      token,
      this.diagnostics
    );

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

    const hierarchy = buildTestHierarchyFromGherkinDocuments(gherkinDocuments);

    for (const pickle of pickles) {
      if (pickle.astNodeIds && pickle.astNodeIds.length > 0) {
        hierarchy.updateNameByAstNodeIds(pickle.astNodeIds, pickle.name);
      }
    }

    this.testTreeManager?.updateTestItemsFromHierarchy(hierarchy);
  }
}
