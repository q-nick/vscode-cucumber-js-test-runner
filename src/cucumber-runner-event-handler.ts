import type * as vscode from 'vscode';

import { CucumberRunnerEvent } from './cucumber-runner';
import { CucumberTestRun } from './cucumber-test-run';
import { logRun, timestampToMilliseconds } from './utilities';
import {
  GherkinDocument,
  Pickle,
  Step,
  TestCase,
  TestCaseFinished,
  TestCaseStarted,
  TestStepFinished,
  TestStepStatus,
} from './zod-schemas';

export class CucumberRunnerEventHandler {
  private vscode: typeof vscode;
  private testStepResults: Map<string, TestStepFinished[]> = new Map();

  constructor(
    vscodeApi: typeof vscode,
    private cucumberTestRun: CucumberTestRun,
    private run: vscode.TestRun,
    private token: vscode.CancellationToken,
    private diagnostics: vscode.DiagnosticCollection
  ) {
    this.vscode = vscodeApi;
  }

  public handle(event: CucumberRunnerEvent) {
    if (this.token.isCancellationRequested) {
      this.run.end();
      return;
    }
    switch (event.type) {
      case 'stdout': {
        this.handleStdout(event.data);
        break;
      }
      case 'gherkinDocument': {
        this.handleGherkinDocument(event.data);
        break;
      }
      case 'pickle': {
        this.handlePickle(event.data);
        break;
      }
      case 'testCase': {
        this.handleTestCase(event.data);
        break;
      }
      case 'testCaseStarted': {
        this.handleTestCaseStarted(event.data);
        break;
      }
      case 'testStepFinished': {
        this.handleTestStepFinished(event.data);
        break;
      }
      case 'testCaseFinished': {
        this.handleTestCaseFinished(event.data);
        break;
      }
    }
  }

  private handleStdout(data: string) {
    logRun(data, this.run);
  }

  private handleGherkinDocument(data: GherkinDocument) {
    this.cucumberTestRun.addGherkinDocument(data);
  }

  private handlePickle(data: Pickle) {
    this.cucumberTestRun.addPickle(data);
  }

  private handleTestCase(data: TestCase) {
    this.cucumberTestRun.addTestCase(data);
  }

  private handleTestCaseStarted(data: TestCaseStarted) {
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

  private handleTestStepFinished(error: TestStepFinished) {
    const { testCaseStartedId, testStepResult, testStepId } = error;
    if (!this.testStepResults.has(testCaseStartedId)) {
      this.testStepResults.set(testCaseStartedId, []);
    }
    this.testStepResults.get(testCaseStartedId)!.push(error);
    // Obsługa statusowania pojedynczego kroku (UNDEFINED)
    if (['FAILED', 'UNDEFINED'].includes(testStepResult.status)) {
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
          error.testStepResult.message || error.testStepResult.status
        );
      }
    }
  }

  private setStepDiagnosticMessage(uri: vscode.Uri, step: Step, message: string) {
    const line = step.location.line - 1;
    const column = (step.location.column ? step.location.column - 1 : 0) + step.keyword.length;
    const range = new this.vscode.Range(line, column, line, column + step.text.length);
    const diagnostic = new this.vscode.Diagnostic(
      range,
      message,
      this.vscode.DiagnosticSeverity.Error
    );
    this.diagnostics.set(uri, [diagnostic]);
  }

  private handleTestCaseFinished(data: TestCaseFinished) {
    const { testCaseStartedId, timestamp } = data;
    const test = this.cucumberTestRun.getTestByCaseStartedId(testCaseStartedId);

    const stepEvents = this.testStepResults.get(testCaseStartedId) || [];
    let scenarioStatus: TestStepStatus = 'PASSED';
    const testCaseStepStatuses = new Set(stepEvents.map((se) => se.testStepResult.status));

    if (testCaseStepStatuses.has('FAILED')) {
      scenarioStatus = 'FAILED';
    } else if (testCaseStepStatuses.has('UNDEFINED')) {
      scenarioStatus = 'FAILED';
    } else if (testCaseStepStatuses.has('AMBIGUOUS')) {
      scenarioStatus = 'FAILED';
    } else if (testCaseStepStatuses.has('SKIPPED')) {
      scenarioStatus = 'SKIPPED';
    } else if (testCaseStepStatuses.has('PENDING')) {
      scenarioStatus = 'SKIPPED';
    }

    // Szukamy testCaseStarted w cucumberTestRun
    const testCaseStarted = this.cucumberTestRun.getTestCaseStartedById(testCaseStartedId);
    const startMs = timestampToMilliseconds(testCaseStarted.timestamp);
    const endMs = timestampToMilliseconds(timestamp);
    const duration = endMs - startMs;

    if (test) {
      const feature = this.cucumberTestRun.getFeatureByTestCaseStartedId(testCaseStartedId);

      switch (scenarioStatus) {
        case 'FAILED': {
          logRun(
            `🔴 (failed) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
            this.run
          );
          this.run.failed(test, [], duration);

          break;
        }
        case 'SKIPPED': {
          logRun(
            `⚪ (skipped) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
            this.run
          );
          this.run.skipped(test);

          break;
        }
        case 'PASSED': {
          logRun(
            `🟢 (passed) Feature: "${feature.name ?? 'Unknown'}" - Scenario: "${test.label}"`,
            this.run
          );
          this.run.passed(test, duration);

          break;
        }
        // No default
      }
    }
  }
}
