import path from 'node:path';

import * as vscode from 'vscode';

import { HierarchyNode } from './test-hierarchy-builder';
import { logDevelopment } from './utilities';

export class TestTreeManager {
  private testController: vscode.TestController;
  private rootPath: string;
  public rootTestItem?: vscode.TestItem;

  constructor(testController: vscode.TestController, rootPath: string) {
    this.testController = testController;
    this.rootPath = rootPath;
  }

  public createRootTestItem() {
    this.rootTestItem = this.testController.createTestItem(
      'root',
      path.basename(this.rootPath),
      vscode.Uri.file(this.rootPath)
    );
    this.testController.items.add(this.rootTestItem);
  }

  public updateTestItemsFromHierarchy(hierarchy: HierarchyNode) {
    if (!this.rootTestItem) {
      this.createRootTestItem();
    }

    if (this.rootTestItem && this.rootTestItem.children) {
      // eslint-disable-next-line unicorn/no-array-for-each
      this.rootTestItem.children.forEach((item) => this.rootTestItem!.children.delete(item.id));
    }

    for (const node of hierarchy.children ?? []) {
      this.addNode(node, this.rootTestItem!);
    }
  }

  private addNode(node: HierarchyNode, parent: vscode.TestItem) {
    const itemUri = node.uri
      ? vscode.Uri.file(path.isAbsolute(node.uri) ? node.uri : path.join(this.rootPath, node.uri))
      : vscode.Uri.file(this.rootPath);

    logDevelopment('[id] ' + node.id);

    const item = this.testController.createTestItem(node.id, node.name, itemUri);
    item.description = node.id;
    if (node.line) {
      item.range = new vscode.Range(
        new vscode.Position(node.line - 1, 0),
        new vscode.Position(node.line - 1, node.name.length)
      );
    }
    parent.children.add(item);

    for (const child of node.children ?? []) {
      this.addNode(child, item);
    }
  }
}
