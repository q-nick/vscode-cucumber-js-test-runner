import { beforeAll, describe, expect, it } from 'vitest';

import { CucumberJsTestController } from '../cucumber-js-test-controller';
import { testDependencies, TestItemWithArrayChildren } from './test-mock-vscode';

describe('CucumberJsTestController', () => {
  let root: TestItemWithArrayChildren | undefined;
  let children: TestItemWithArrayChildren[] | undefined;

  beforeAll(async () => {
    const controller = new CucumberJsTestController(testDependencies);
    controller.initializeWorkspace();
    controller.initializeCucumber();
    await controller.discoverTests();
    root = controller.testTreeManager?.rootTestItem as unknown as TestItemWithArrayChildren;
    children = root?.children;
  });

  it('scenario order', () => {
    expect(root?.label).toBe('tests');
    expect(children).toHaveLength(1);

    expect(children?.[0]?.label).toBe('some-folder');

    const someFolder = children?.[0];

    expect(someFolder?.children[0]?.label).toBe('01-empty-file.feature');
    expect(someFolder?.children[1]?.label).toBe('Feature: Nie mam scenariuszy');
    expect(someFolder?.children[2]?.label).toBe('Feature: Podstawowe dodawanie liczb');
    expect(someFolder?.children[3]?.label).toBe('Feature: Dodawanie liczb z Background');
    expect(someFolder?.children[4]?.label).toBe('Feature: Dodawanie liczb z różnymi wartościami');
    expect(someFolder?.children[5]?.label).toBe('Feature: Dodawanie liczb z regułami');
  });

  it('empty file', () => {
    const emptyFile = children?.[0]?.children[0];

    expect(emptyFile).toMatchObject({
      id: 'some-folder/01-empty-file.feature',
      label: '01-empty-file.feature',
    });

    expect(emptyFile?.children).toHaveLength(0);
  });

  it('empty feature', () => {
    const emptyFeature = children?.[0]?.children[1];

    expect(emptyFeature).toMatchObject({
      id: 'some-folder/02-empty-feature.feature',
      label: 'Feature: Nie mam scenariuszy',
    });

    expect(emptyFeature?.children).toHaveLength(0);
  });

  it('basic scenario', () => {
    const basicScenario = children?.[0]?.children[2];

    expect(basicScenario).toMatchObject({
      id: 'some-folder/03-basic-scenario.feature',
      label: 'Feature: Podstawowe dodawanie liczb',
    });

    expect(basicScenario?.children[0]).toMatchObject({
      id: String.raw`some-folder\03-basic-scenario.feature:3`,
      label: 'Scenario: Dodawanie dwóch liczb',
    });

    expect(basicScenario?.children[0].children).toHaveLength(0);
  });

  it('background scenario', () => {
    const backgroundScenario = children?.[0]?.children[3];

    expect(backgroundScenario).toMatchObject({
      id: 'some-folder/04-background-scenario.feature',
      label: 'Feature: Dodawanie liczb z Background',
    });

    expect(backgroundScenario?.children[0]).toMatchObject({
      id: String.raw`some-folder\04-background-scenario.feature:7`,
      label: 'Scenario: Dodawanie wielu liczb',
    });

    expect(backgroundScenario?.children[0].children).toHaveLength(0);
  });

  it('scenario outline', () => {
    const scenarioOutline = children?.[0]?.children[4];
    expect(scenarioOutline).toMatchObject({
      id: 'some-folder/05-scenario-outline.feature',
      label: 'Feature: Dodawanie liczb z różnymi wartościami',
    });

    expect(scenarioOutline?.children).toHaveLength(1);

    expect(scenarioOutline?.children[0]).toMatchObject({
      id: String.raw`some-folder\05-scenario-outline.feature:3`,
      label: 'Outline: Dodawanie różnych liczb <liczba1> i <liczba2>',
    });
    expect(scenarioOutline?.children[0].children).toHaveLength(2);

    expect(scenarioOutline?.children[0].children[0]).toMatchObject({
      id: String.raw`some-folder\05-scenario-outline.feature:10`,
      label: 'Scenario: Dodawanie różnych liczb 5 i 3',
    });
    expect(scenarioOutline?.children[0].children[0].children).toHaveLength(0);

    expect(scenarioOutline?.children[0].children[1]).toMatchObject({
      id: String.raw`some-folder\05-scenario-outline.feature:11`,
      label: 'Scenario: Dodawanie różnych liczb 10 i 7',
    });
    expect(scenarioOutline?.children[0].children[1].children).toHaveLength(0);
  });

  // trzeba zbudwoac prosta hierarchie z gherkin documents bo tam jest rule
  // jednak nazwy scenariuszy wziac z pickles bo tam sa wygenerowane scenario outline nazwy
  // nie ma innej drogi
  it('rule scenario #1', () => {
    const ruleScenario = children?.[0]?.children[5];

    expect(ruleScenario).toMatchObject({
      id: 'some-folder/06-rule-scenario.feature',
      label: 'Feature: Dodawanie liczb z regułami',
    });
    expect(ruleScenario?.children).toHaveLength(2);

    expect(ruleScenario?.children[0]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:3`,
      label: 'Rule: Dodawanie liczb dodatnich',
    });
    expect(ruleScenario?.children[0].children).toHaveLength(1);

    expect(ruleScenario?.children[0].children[0]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:7`,
      label: 'Scenario: Dodawanie liczb dodatnich 5 i 3',
    });
    expect(ruleScenario?.children[0].children[0].children).toHaveLength(0);
  });

  it('rule scenario #2 - with Outline', () => {
    const ruleScenario = children?.[0]?.children[5];

    expect(ruleScenario).toMatchObject({
      id: 'some-folder/06-rule-scenario.feature',
      label: 'Feature: Dodawanie liczb z regułami',
    });
    expect(ruleScenario?.children).toHaveLength(2);

    // second Rule
    expect(ruleScenario?.children[1]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:12`,
      label: 'Rule: Dodawanie liczb ujemnych',
    });
    expect(ruleScenario?.children[1].children).toHaveLength(1);

    expect(ruleScenario?.children[1].children[0]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:16`,
      label: 'Outline: Dodawanie różnych liczb <liczba1> i <liczba2>',
    });
    expect(ruleScenario?.children[1].children[0].children).toHaveLength(2);

    expect(ruleScenario?.children[1].children[0].children[0]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:23`,
      label: 'Scenario: Dodawanie różnych liczb 5 i 3',
    });
    expect(ruleScenario?.children[1].children[0].children[0].children).toHaveLength(0);

    expect(ruleScenario?.children[1].children[0].children[1]).toMatchObject({
      id: String.raw`some-folder\06-rule-scenario.feature:24`,
      label: 'Scenario: Dodawanie różnych liczb 10 i 7',
    });
    expect(ruleScenario?.children[1].children[0].children[1].children).toHaveLength(0);
  });
});
