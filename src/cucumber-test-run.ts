import * as vscode from 'vscode';

import { logDevelopment } from './utilities';
import { Feature, GherkinDocument, Pickle, Step, TestCase, TestCaseStarted } from './zod-schemas';

export class CucumberTestRun {
  private gherkinDocuments: GherkinDocument[] = [];
  private pickles: Pickle[] = [];
  private testCases: TestCase[] = [];
  private testCasesStarted: TestCaseStarted[] = [];
  private astNodeIdToLocation: Record<string, { uri: string; line: number; name: string }> = {};

  constructor(private testsToRun: vscode.TestItem[]) {}

  addGherkinDocument(document: GherkinDocument): void {
    this.gherkinDocuments.push(document);
    this.buildAstNodeIdMapping();
  }

  addPickle(pickle: Pickle): void {
    this.pickles.push(pickle);
  }

  addTestCase(testCase: TestCase): void {
    this.testCases.push(testCase);
  }

  addTestCaseStarted(testCaseStarted: TestCaseStarted): void {
    this.testCasesStarted.push(testCaseStarted);
  }

  /**
   * Builds mapping from astNodeId to location information (uri, line, name)
   * This is similar to the mapping in buildTestHierarchyFromPickles
   */
  private buildAstNodeIdMapping(): void {
    this.astNodeIdToLocation = {};

    for (const document of this.gherkinDocuments) {
      const { uri, feature } = document;
      if (!feature) {
        continue;
      }

      for (const child of feature.children) {
        if (child.scenario) {
          const { scenario } = child;
          this.astNodeIdToLocation[scenario.id] = {
            uri,
            line: scenario.location.line,
            name: scenario.name,
          };

          if (scenario.examples) {
            for (const ex of scenario.examples) {
              this.astNodeIdToLocation[ex.id] = {
                uri,
                line: ex.location.line,
                name: ex.name || scenario.name,
              };

              if (ex.tableBody) {
                for (const row of ex.tableBody) {
                  this.astNodeIdToLocation[row.id] = {
                    uri,
                    line: row.location.line,
                    name: `${ex.name || scenario.name}:${row.location.line}`,
                  };
                }
              }
            }
          }
        }
        if (child.background) {
          const { background } = child;
          this.astNodeIdToLocation[background.id] = {
            uri,
            line: background.location.line,
            name: background.name,
          };
        }
      }
    }
  }

  /**
   * Gets line number from astNodeId using the mapping
   */
  private getLineFromAstNodeId(astNodeId: string): number | undefined {
    return this.astNodeIdToLocation[astNodeId]?.line;
  }

  /**
   * Finds a test by trying all astNodeIds from a pickle
   * Returns the first test that matches any of the astNodeIds
   */
  private findTestByPickleAndAstNodeIds(pickle: Pickle): vscode.TestItem | undefined {
    // Try all astNodeIds to find which one returns a valid test
    if (pickle.astNodeIds && pickle.astNodeIds.length > 0) {
      for (const astNodeId of pickle.astNodeIds) {
        const line = this.getLineFromAstNodeId(astNodeId);
        if (line !== undefined) {
          const testId = `${pickle.uri}:${line}`;
          const test = this.testsToRun.find((t) => t.id === testId);
          if (test) {
            return test;
          }
        }
      }
    }

    // Fallback: try without line number
    const testId = `${pickle.uri}:`;
    const test = this.testsToRun.find((t) => t.id === testId);
    return test;
  }

  /**
   * Finds the step definition in the GherkinDocument based on testCaseStartedId and stepId
   * Throws an error if any element in the chain is not found
   */
  findStepInGherkinDocumentByTestCaseStartedId(testCaseStartedId: string, stepId: string): Step {
    // 1. Find the testCaseStarted object by testCaseStartedId
    const testCaseStarted = this.testCasesStarted.find((tc) => tc.id === testCaseStartedId);
    if (!testCaseStarted) {
      throw new Error(`Could not find testCaseStarted with id: ${testCaseStartedId}`);
    }

    // 2. Find the testCase object related to testCaseStarted
    const testCase = this.testCases.find((tc) => tc.id === testCaseStarted.testCaseId);
    if (!testCase) {
      throw new Error(`Could not find testCase with id: ${testCaseStarted.testCaseId}`);
    }

    // 3. Find the pickleStepId related to the given stepId in testCase
    const pickleStepId = testCase.testSteps.find((ts) => ts.id === stepId)?.pickleStepId;
    if (!pickleStepId) {
      throw new Error(
        `Could not find pickleStepId for stepId: ${stepId} in testCase: ${testCase.id}`
      );
    }

    // 4. Find the pickle object related to testCase
    const pickle = this.pickles.find((p) => p.id === testCase.pickleId);
    if (!pickle) {
      throw new Error(`Could not find pickle with id: ${testCase.pickleId}`);
    }

    // 5. Find the pickleStep with pickleStepId in pickle
    const pickleStep = pickle.steps.find((step) => step.id === pickleStepId);
    if (!pickleStep) {
      throw new Error(
        `Could not find pickleStep with id: ${pickleStepId} in pickle with id: ${pickle.id}`
      );
    }

    // 6. Get the first astNodeId from pickleStep (corresponds to the step id in GherkinDocument)
    const astNodeId = pickleStep.astNodeIds[0];
    if (!astNodeId) {
      throw new Error(`No astNodeId in pickleStep with id: ${pickleStepId}`);
    }

    // 7. Find the GherkinDocument related to pickle
    const gherkinDocument = this.gherkinDocuments.find((document) => document.uri === pickle.uri);
    if (!gherkinDocument || !gherkinDocument.feature) {
      throw new Error(`Could not find GherkinDocument with uri: ${pickle.uri}`);
    }

    // 8. Search all steps in scenarios and backgrounds by astNodeId
    for (const child of gherkinDocument.feature.children) {
      if (child.scenario) {
        const step = child.scenario.steps.find((s) => s.id === astNodeId);
        if (step) {
          return step;
        }
      }
      if (child.background) {
        const step = child.background.steps.find((s) => s.id === astNodeId);
        if (step) {
          return step;
        }
      }
    }

    throw new Error(
      `Could not find step with astNodeId: ${astNodeId} in GherkinDocument uri: ${gherkinDocument.uri}`
    );
  }

  /**
   * Zwraca TestCase na podstawie testCaseStartedId
   * Rzuca błąd jeśli nie znajdzie któregoś z elementów
   */
  getTestCaseByTestCaseStartedId(testCaseStartedId: string): TestCase {
    const testCaseStarted = this.testCasesStarted.find((tc) => tc.id === testCaseStartedId);

    if (!testCaseStarted) {
      throw new Error(`Nie znaleziono testCaseStarted o id: ${testCaseStartedId}`);
    }
    const testCase = this.testCases.find((tc) => tc.id === testCaseStarted.testCaseId);
    if (!testCase) {
      throw new Error(`Nie znaleziono testCase o id: ${testCaseStarted.testCaseId}`);
    }
    return testCase;
  }

  /**
   * Returns the vscode.TestItem for a given testCaseId, based on pickleId and test node id (uri+line)
   * Throws an error if not found
   */
  getTestByCaseId(testCaseId: string): vscode.TestItem {
    const testCase = this.testCases.find((tc) => tc.id === testCaseId);
    if (testCase) {
      const pickle = this.pickles.find((p) => p.id === testCase.pickleId);

      if (pickle) {
        const test = this.findTestByPickleAndAstNodeIds(pickle);

        if (test) {
          return test;
        }
      }
    }
    throw new Error(`Could not find test for testCaseId: ${testCaseId}`);
  }

  /**
   * Returns the vscode.TestItem for a given testCaseStartedId, using getTestByCaseId internally
   * Throws an error if not found
   */
  getTestByCaseStartedId(testCaseStartedId: string): vscode.TestItem {
    const testCaseStarted = this.testCasesStarted.find((tc) => tc.id === testCaseStartedId);
    if (testCaseStarted) {
      return this.getTestByCaseId(testCaseStarted.testCaseId);
    }
    throw new Error(`Could not find test for testCaseStartedId: ${testCaseStartedId}`);
  }

  /**
   * Zwraca TestCaseStarted na podstawie testCaseStartedId
   * Rzuca błąd jeśli nie znajdzie
   */
  getTestCaseStartedById(testCaseStartedId: string): TestCaseStarted {
    const testCaseStarted = this.testCasesStarted.find((tc) => tc.id === testCaseStartedId);
    if (!testCaseStarted) {
      throw new Error(`Nie znaleziono testCaseStarted o id: ${testCaseStartedId}`);
    }
    return testCaseStarted;
  }

  getFeatureByTestCaseStartedId(testCaseStartedId: string): Feature {
    const testCaseStarted = this.testCasesStarted.find((tc) => tc.id === testCaseStartedId);
    if (!testCaseStarted) {
      throw new Error(`Nie znaleziono testCaseStarted o id: ${testCaseStartedId}`);
    }
    const testCase = this.testCases.find((tc) => tc.id === testCaseStarted.testCaseId);
    if (!testCase) {
      throw new Error(`Nie znaleziono testCase o id: ${testCaseStarted.testCaseId}`);
    }
    const pickle = this.pickles.find((p) => p.id === testCase.pickleId);
    if (!pickle) {
      throw new Error(`Nie znaleziono pickle o id: ${testCase.pickleId}`);
    }
    const gherkinDocument = this.gherkinDocuments.find((document) => document.uri === pickle.uri);
    if (!gherkinDocument) {
      throw new Error(`Nie znaleziono GherkinDocument o uri: ${pickle.uri}`);
    }
    if (!gherkinDocument.feature) {
      throw new Error(`GherkinDocument o uri: ${pickle.uri} nie zawiera feature`);
    }
    return gherkinDocument.feature;
  }
}
