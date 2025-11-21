import { FeatureChild, GherkinDocument, Rule, Scenario } from './zod-schemas';

export type HierarchyNodeKind =
  | 'root'
  | 'folder'
  | 'feature'
  | 'rule'
  | 'scenario'
  | 'scenarioOutline'
  | 'example';

export class HierarchyNode {
  public readonly id: string;
  public name: string;
  public readonly kind: HierarchyNodeKind;
  public uri: string | undefined;
  public line: number | undefined;
  public readonly astNodeId: string | undefined;
  public readonly children: HierarchyNode[];

  constructor(parameters: {
    kind: HierarchyNodeKind;
    id: string;
    name: string;
    uri?: string;
    line?: number;
    astNodeId?: string;
    children?: HierarchyNode[];
  }) {
    this.kind = parameters.kind;
    this.id = parameters.id;
    this.name = parameters.name;
    this.uri = parameters.uri;
    this.line = parameters.line;
    this.astNodeId = parameters.astNodeId;
    this.children = parameters.children ?? [];
  }

  public static createRoot(): HierarchyNode {
    return new HierarchyNode({ kind: 'root', id: 'root', name: 'root', children: [] });
  }

  public addChild(node: HierarchyNode): HierarchyNode {
    this.children.push(node);
    return node;
  }

  public findByAstNodeId(astNodeId: string): HierarchyNode | undefined {
    // Sprawdź czy ten węzeł ma pasujący astNodeId
    if (this.astNodeId === astNodeId) {
      return this;
    }

    // Rekurencyjnie przeszukaj children
    for (const child of this.children) {
      const found = child.findByAstNodeId(astNodeId);
      if (found) {
        return found;
      }
    }

    return undefined;
  }

  public update(
    astNodeId: string,
    updates: Partial<Pick<HierarchyNode, 'name' | 'uri' | 'line'>>
  ): boolean {
    const node = this.findByAstNodeId(astNodeId);
    if (!node) {
      return false;
    }

    if (updates.name !== undefined) {
      node.name = updates.name;
    }
    if (updates.uri !== undefined) {
      node.uri = updates.uri;
    }
    if (updates.line !== undefined) {
      node.line = updates.line;
    }
    return true;
  }

  public updateNameByAstNodeIds(astNodeIds: string[], name: string): void {
    if (astNodeIds.length === 0) {
      return;
    }

    // Dla example, ostatni astNodeId to row.id
    const lastAstNodeId = astNodeIds.at(-1);
    if (lastAstNodeId) {
      const node = this.findByAstNodeId(lastAstNodeId);
      if (node && node.kind === 'example') {
        this.update(lastAstNodeId, { name: 'Scenario: ' + name });
      }
    }

    // Dla scenario, scenarioOutline, rule - pierwszy astNodeId to scenario/rule id
    const firstAstNodeId = astNodeIds[0];
    if (firstAstNodeId) {
      const node = this.findByAstNodeId(firstAstNodeId);
      if (node) {
        switch (node.kind) {
          case 'scenario': {
            this.update(firstAstNodeId, { name: 'Scenario: ' + name });
            break;
          }
          // case 'scenarioOutline': {
          //   this.update(firstAstNodeId, { name: 'Outline: ' + name });
          //   break;
          // }
          // case 'rule': {
          //   this.update(firstAstNodeId, { name: 'Rule: ' + name });
          //   break;
          // }
        }
      }
    }
  }

  public addDocument(document: GherkinDocument): void {
    const { uri, feature } = document;

    if (!feature) {
      this.insertFeatureNode(uri);
      return;
    }
    const featureNode = this.insertFeatureNode(uri, feature.name);
    featureNode.appendFeatureChildren(feature.children, uri);
  }

  public insertFeatureNode(uri: string, name?: string): HierarchyNode {
    const normalizedUri = uri.replaceAll('\\', '/');
    const parts = normalizedUri.split('/');
    const filename = parts.pop()!;

    const traverse = (node: HierarchyNode, parentId: string, index: number): HierarchyNode => {
      if (index === parts.length) {
        const featureNode = new HierarchyNode({
          kind: 'feature',
          id: buildNodeId(parentId, filename),
          name: name ? 'Feature: ' + name : filename,
          uri,
          children: [],
        });
        node.addChild(featureNode);
        return featureNode;
      }

      const nextNode = node.findOrCreateFolderChild(parts[index]!, parentId);
      return traverse(nextNode, nextNode.id, index + 1);
    };

    return traverse(this, this.id, 0);
  }

  public appendFeatureChildren(children: FeatureChild[], uri: string): void {
    for (const child of children) {
      if (child.scenario) {
        const scenarioNode =
          child.scenario.examples && child.scenario.examples.length > 0
            ? HierarchyNode.createScenarioOutlineNode(child.scenario, uri)
            : HierarchyNode.createScenarioNode(child.scenario, uri);
        this.addChild(scenarioNode);
      }
      if (child.rule) {
        const ruleNode = HierarchyNode.createRuleNode(child.rule, uri);
        this.addChild(ruleNode);
        ruleNode.appendFeatureChildren(child.rule.children, uri);
      }
    }
  }

  private static createScenarioNode(scenario: Scenario, uri: string): HierarchyNode {
    return new HierarchyNode({
      kind: 'scenario',
      id: `${uri}:${scenario.location.line}`,
      name: 'Scenario: ' + scenario.name,
      children: [],
      uri,
      line: scenario.location.line,
      astNodeId: scenario.id,
    });
  }

  private static createScenarioOutlineNode(scenario: Scenario, uri: string): HierarchyNode {
    const outlineNode = new HierarchyNode({
      kind: 'scenarioOutline',
      id: `${uri}:${scenario.location.line}`,
      name: 'Outline: ' + scenario.name,
      uri,
      line: scenario.location.line,
      astNodeId: scenario.id,
      children: [],
    });
    HierarchyNode.appendExampleChildren(outlineNode, scenario, uri);
    return outlineNode;
  }

  private static createRuleNode(rule: Rule, uri: string): HierarchyNode {
    return new HierarchyNode({
      kind: 'rule',
      id: `${uri}:${rule.location.line}`,
      name: 'Rule: ' + rule.name,
      uri,
      line: rule.location.line,
      astNodeId: rule.id,
      children: [],
    });
  }

  private static appendExampleChildren(node: HierarchyNode, scenario: Scenario, uri: string): void {
    if (!scenario.examples) {
      return;
    }

    for (const example of scenario.examples) {
      if (!example.tableBody) {
        continue;
      }
      const exampleName = example.name || scenario.name;
      for (const row of example.tableBody) {
        node.addChild(
          new HierarchyNode({
            kind: 'example',
            id: `${uri}:${row.location.line}`,
            name: `Scenario: ${exampleName}:${row.location.line}`,
            uri,
            line: row.location.line,
            astNodeId: row.id,
            children: [],
          })
        );
      }
    }
  }

  private findOrCreateFolderChild(name: string, parentId: string): HierarchyNode {
    for (const child of this.children) {
      if (child.kind === 'folder' && child.name === name) {
        return child;
      }
    }

    const folderNode = new HierarchyNode({
      kind: 'folder',
      id: buildNodeId(parentId, name),
      name,
      children: [],
    });
    this.addChild(folderNode);
    return folderNode;
  }
}

export function buildNodeId(parentId: string, name: string): string {
  const safeName = name.replaceAll(/\s+/g, '_');
  const normalizedParentId = parentId.replaceAll('\\', '/');
  return normalizedParentId === 'root' ? safeName : `${normalizedParentId}/${safeName}`;
}

export function buildTestHierarchyFromGherkinDocuments(
  gherkinDocuments: GherkinDocument[]
): HierarchyNode {
  const root = HierarchyNode.createRoot();

  // Process each Gherkin document
  for (const document of gherkinDocuments) {
    root.addDocument(document);
  }

  return root;
}
