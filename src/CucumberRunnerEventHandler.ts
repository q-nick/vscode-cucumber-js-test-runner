import * as vscode from 'vscode';
import { TestStepFinished, TestStepStatus } from './zodSchemas';
import { logRun, timestampToMilliseconds } from './utils';
import { CucumberTestRun } from './CucumberTestRun';
import { CucumberRunnerEvent } from './CucumberRunner';

export class CucumberRunnerEventHandler {
  private testStepResults: Map<string, TestStepFinished[]> = new Map();
  private diagnostics = vscode.languages.createDiagnosticCollection('cucumber');

  constructor(
    private cucumberTestRun: CucumberTestRun,
    private run: vscode.TestRun,
    private token: vscode.CancellationToken
  ) {}

  public handle(event: CucumberRunnerEvent) {
    if (this.token.isCancellationRequested) {
      this.run.end();
      return;
    }
    switch (event.type) {
      case 'stdout':
        this.handleStdout(event.data);
        break;
      case 'gherkinDocument':
        this.handleGherkinDocument(event.data);
        break;
      case 'pickle':
        this.handlePickle(event.data);
        break;
      case 'testCase':
        this.handleTestCase(event.data);
        break;
      case 'testCaseStarted':
        this.handleTestCaseStarted(event.data);
        break;
      case 'testStepFinished':
        this.handleTestStepFinished(event.data);
        break;
      case 'testCaseFinished':
        this.handleTestCaseFinished(event.data);
        break;
      // Możesz dodać kolejne eventy tutaj
    }
  }

  private handleStdout(data: string) {
    logRun(data, this.run);
  }

  private handleGherkinDocument(data: any) {
    this.cucumberTestRun.addGherkinDocument(data);
  }

  private handlePickle(data: any) {
    this.cucumberTestRun.addPickle(data);
  }

  private handleTestCase(data: any) {
    this.cucumberTestRun.addTestCase(data);
  }

  private handleTestCaseStarted(data: any) {
    this.cucumberTestRun.addTestCaseStarted(data);
    const test = this.cucumberTestRun.getTestByCaseStartedId(data.id);
    if (test) {
      const feature = this.cucumberTestRun.getFeatureByTestCaseStartedId(data.id);
      logRun(
        `🚀 (started) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
        this.run
      );
    }
  }

  private handleTestStepFinished(data: TestStepFinished) {
    const { testCaseStartedId, testStepResult, testStepId } = data;
    if (!this.testStepResults.has(testCaseStartedId)) {
      this.testStepResults.set(testCaseStartedId, []);
    }
    this.testStepResults.get(testCaseStartedId)!.push(data);
    // Obsługa statusowania pojedynczego kroku (UNDEFINED)
    if (testStepResult.status === 'UNDEFINED') {
      const testCase = this.cucumberTestRun.getTestCaseByTestCaseStartedId(testCaseStartedId);
      const step = this.cucumberTestRun.findStepInGherkinDocumentByTestCaseStartedId(
        testCaseStartedId,
        testStepId
      );
      const test = this.cucumberTestRun.getTestByCaseId(testCase.id);
      if (step && test.uri) {
        this.setStepDiagnosticMessage(
          test.uri,
          step,
          testStepResult.message || testStepResult.status
        );
      }
    }
  }

  private setStepDiagnosticMessage(uri: vscode.Uri, step: any, message: string) {
    const line = step.location.line - 1;
    const column = (step.location.column ? step.location.column - 1 : 0) + step.keyword.length;
    const range = new vscode.Range(line, column, line, column + step.text.length);
    const diagnostic = new vscode.Diagnostic(range, message, vscode.DiagnosticSeverity.Error);
    this.diagnostics.set(uri, [diagnostic]);
  }

  private handleTestCaseFinished(data: any) {
    const { testCaseStartedId, timestamp } = data;
    const test = this.cucumberTestRun.getTestByCaseStartedId(testCaseStartedId);
    const stepEvents = this.testStepResults.get(testCaseStartedId) || [];
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

    // Szukamy testCaseStarted w cucumberTestRun
    const testCaseStarted = this.cucumberTestRun.getTestCaseStartedById(testCaseStartedId);
    const startMs = timestampToMilliseconds(testCaseStarted.timestamp);
    const endMs = timestampToMilliseconds(timestamp);
    const duration = endMs - startMs;

    if (test) {
      const feature = this.cucumberTestRun.getFeatureByTestCaseStartedId(testCaseStartedId);
      if (scenarioStatus === 'FAILED') {
        logRun(
          `🔴 (failed) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
          this.run
        );
        this.run.failed(test, [], duration);
      } else if (scenarioStatus === 'SKIPPED') {
        logRun(
          `⚪ (skipped) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
          this.run
        );
        this.run.skipped(test);
      } else if (scenarioStatus === 'PASSED') {
        logRun(
          `🟢 (passed) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
          this.run
        );
        this.run.passed(test, duration);
      }
    }
  }
}
