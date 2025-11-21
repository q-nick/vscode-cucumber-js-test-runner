import path from 'node:path';

import type * as vscode from 'vscode';

import { CucumberJsTestControllerDependencies } from '../cucumber-js-test-controller';

export type TestItemWithArrayChildren = Omit<vscode.TestItem, 'children'> & {
  children: TestItemWithArrayChildren[];
};

function createTestItemCollection() {
  const items: { id: string }[] = [];

  return Object.assign(items, {
    add: (item: { id: string }) => {
      items.push(item);
    },
    delete: (id: string) => {
      const index = items.findIndex((item) => item.id === id);
      if (index !== -1) {
        items.splice(index, 1);
      }
    },
    replace: (newItems: { id: string }[]) => {
      items.length = 0;
      items.push(...newItems);
    },
    get size() {
      return items.length;
    },
  });
}

function createTestItem(id: string, name: string, uri?: { fsPath: string }) {
  const children = createTestItemCollection();

  return {
    id,
    label: name,
    uri,
    children,
    description: undefined as string | undefined,
    range: undefined as unknown,
  };
}

export const testDependencies: CucumberJsTestControllerDependencies = {
  vscode: {
    tests: {
      createTestController: () => {
        const items = createTestItemCollection();

        return {
          items,
          resolveHandler: async () => {},
          createTestItem: (id: string, name: string, uri?: { fsPath: string }) => {
            return createTestItem(id, name, uri);
          },
        };
      },
    },
    languages: {
      createDiagnosticCollection: () => ({}),
    },
    Uri: {
      file: (path: string) => ({
        fsPath: path,
      }),
    },
    EventEmitter: function () {
      return {
        event: () => ({}),
        fire: () => {},
      };
    },
    Position: class {
      public line: number;

      public character: number;

      constructor(line: number, character: number) {
        this.line = line;
        this.character = character;
      }
    },
    Range: class {
      public start: { line: number; character: number };

      public end: { line: number; character: number };

      constructor(
        start: { line: number; character: number },
        end: { line: number; character: number }
      ) {
        this.start = start;
        this.end = end;
      }
    },
  } as unknown as CucumberJsTestControllerDependencies['vscode'],
  workspaceRootPathProvider: () => path.join(process.cwd(), 'src', 'tests'),
};
