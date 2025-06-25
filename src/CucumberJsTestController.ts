import * as vscode from 'vscode';
import * as path from 'path';
import { CucumberRunner, CucumberRunnerEvent } from './CucumberRunner';
import { buildTestHierarchy } from './testHierarchyBuilder';
import { GherkinDocument, TestStepStatus, TestStepFinished } from './zodSchemas';
import { logTestOutput } from './utils';
import { TestTreeManager } from './TestTreeManager';
import { CucumberTestRun } from './CucumberTestRun';

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

  public async runTests(
    request: vscode.TestRunRequest,
    token: vscode.CancellationToken
  ): Promise<void> {
    if (!this.cucumberRunner) {
      throw new Error('CucumberRunner is not initialized. Call initializeWorkspace first.');
    }
    const run = this.vscodeTestController.createTestRun(request);
    const testsToRun: vscode.TestItem[] = [];

    // Zbierz testy do uruchomienia (rekurencyjnie)
    const collectTests = (item: vscode.TestItem): void => {
      testsToRun.push(item);
      item.children.forEach((child) => {
        collectTests(child);
      });
    };
    if (request.include) {
      request.include.forEach((item) => {
        collectTests(item);
      });
    } else if (this.testTreeManager?.rootTestItem) {
      collectTests(this.testTreeManager.rootTestItem);
    }

    // Oznacz wszystkie jako started
    for (const test of testsToRun) {
      run.started(test);
    }

    // Mapuj testy po id
    const testMap = new Map<string, vscode.TestItem>();
    for (const test of testsToRun) {
      testMap.set(test.id, test);
    }

    const cucumberTestRun = new CucumberTestRun(testsToRun);

    // Tymczasowa mapa na eventy testStepFinished dla każdego testCaseStartedId
    const testStepResults = new Map<string, TestStepFinished[]>();

    // Obsługa eventów test run przez callback
    const eventHandler = (event: CucumberRunnerEvent): void => {
      if (token.isCancellationRequested) {
        run.end();
        return;
      }

      if (event.type === 'stdout') {
        logTestOutput(event.data, undefined, '[testrun]');
      }

      if (event.type === 'gherkinDocument') {
        cucumberTestRun.addGherkinDocument(event.data);
      }

      if (event.type === 'pickle') {
        cucumberTestRun.addPickle(event.data);
      }

      if (event.type === 'testCase') {
        cucumberTestRun.addTestCase(event.data);
      }

      if (event.type === 'testCaseStarted') {
        cucumberTestRun.addTestCaseStarted(event.data);
      }

      if (event.type === 'testStepFinished') {
        // Zbieraj całe eventy testStepFinished do tymczasowej mapy
        const { testCaseStartedId } = event.data;
        if (!testStepResults.has(testCaseStartedId)) {
          testStepResults.set(testCaseStartedId, []);
        }
        testStepResults.get(testCaseStartedId)!.push(event.data);

        // Obsługa statusowania pojedynczego kroku (na razie tylko UNDEFINED)
        const { testStepResult, testStepId } = event.data;
        if (testStepResult.status === 'UNDEFINED') {
          const testCase = cucumberTestRun.getTestCaseByTestCaseStartedId(testCaseStartedId);
          const step = cucumberTestRun.findStepInGherkinDocumentByTestCaseStartedId(
            testCaseStartedId,
            testStepId
          );
          const test = cucumberTestRun.getTestByCaseId(testCase?.id);

          const line = step.location.line - 1;
          const baseColumn = step.location.column ? step.location.column - 1 : 0;
          const column = baseColumn + step.keyword.length;
          const diagnostic = new vscode.Diagnostic(
            new vscode.Range(line, column, line, column + step.text.length),
            testStepResult.message || testStepResult.status,
            vscode.DiagnosticSeverity.Error
          );
          const diagnostics = vscode.languages.createDiagnosticCollection('cucumber');
          diagnostics.set(test.uri!, [diagnostic]);
        }
      }

      if (event.type === 'testCaseFinished') {
        const { testCaseStartedId } = event.data;
        console.log('[FLOW] [CASE]', testCaseStartedId);
        const test = cucumberTestRun.getTestByCaseStartedId(testCaseStartedId!);
        const stepEvents = testStepResults.get(testCaseStartedId!) || [];
        let scenarioStatus: TestStepStatus = 'PASSED';
        const testCaseStepStatuses = stepEvents.map((e) => e.testStepResult.status);
        if (testCaseStepStatuses.includes('FAILED')) {
          scenarioStatus = 'FAILED';
        } else if (testCaseStepStatuses.includes('SKIPPED')) {
          scenarioStatus = 'SKIPPED';
        } else if (testCaseStepStatuses.includes('AMBIGUOUS')) {
          scenarioStatus = 'FAILED';
        } else if (testCaseStepStatuses.includes('PENDING')) {
          scenarioStatus = 'SKIPPED';
        } else if (testCaseStepStatuses.includes('UNDEFINED')) {
          scenarioStatus = 'FAILED';
        }
        console.log({ testCaseStepStatuses, scenarioStatus, test });
        if (test) {
          if (scenarioStatus === 'PASSED') {
            run.passed(test);
          } else if (scenarioStatus === 'FAILED') {
            run.failed(test, new vscode.TestMessage('Scenario failed'));
          } else if (scenarioStatus === 'SKIPPED') {
            run.skipped(test);
          }
        }
      }
    };

    // Buduj argumenty do cucumber-js
    const args: string[] = [];
    let useTmpConfig = false;
    if (request.include && request.include.length > 0) {
      for (const test of request.include) {
        if (test.uri) {
          const relativePath = path.relative(this.rootPath, test.uri.fsPath);
          const line = test.range ? `:${test.range.start.line + 1}` : '';
          args.push(`${relativePath}${line}`);
          useTmpConfig = true;
        }
      }
    }
    // Domyślnie uruchom wszystko

    if (useTmpConfig) {
      await this.cucumberRunner.runCucumberWithTmpConfig(args, run, eventHandler);
    } else {
      await this.cucumberRunner.runCucumber(args, run, eventHandler);
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
