import { GherkinDocument } from './zodSchemas';

export interface HierarchyNode {
  id: string;
  name: string;
  children: HierarchyNode[];
  uri?: string;
  line?: number;
}

export function buildNodeId(parentId: string, name: string): string {
  const safeName = name.replace(/\s+/g, '_');
  const normalizedParentId = parentId.replace(/\\/g, '/');
  return normalizedParentId === 'root' ? safeName : `${normalizedParentId}/${safeName}`;
}

export function buildTestHierarchy(gherkinDocuments: GherkinDocument[]): HierarchyNode {
  const root: HierarchyNode = { id: 'root', name: 'root', children: [] };
  const folderMap: Record<string, HierarchyNode> = { root };

  for (const gherkinDocument of gherkinDocuments) {
    const { uri, feature } = gherkinDocument;

    if (!feature) {
      continue;
    }

    // Rozbij ścieżkę na foldery
    const normalizedUri = uri.replace(/\\/g, '/');
    const parts = normalizedUri.split('/');
    parts.pop(); // remove filename
    let currentPath = '';
    let parentNode = root;
    let parentId = normalizedUri;

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      const nextId = buildNodeId(parentId, part);
      if (!folderMap[currentPath]) {
        const folderNode: HierarchyNode = { id: nextId, name: part, children: [] };
        folderMap[currentPath] = folderNode;

        parentNode.children.push(folderNode);
      }
      parentNode = folderMap[currentPath];
      parentId = nextId;
    }

    // Dodaj feature jako node
    const featureId = buildNodeId(parentId, feature.name);
    const featureNode: HierarchyNode = {
      id: featureId,
      name: feature.name,
      children: [],
      uri,
    };

    parentNode.children.push(featureNode);

    // Dodaj scenariusze i outline
    if (feature.children) {
      for (const child of feature.children) {
        if (child.scenario) {
          const scenario = child.scenario;
          const isOutline = !!scenario.examples && scenario.examples.length > 0;
          if (isOutline && scenario.examples) {
            // Outline jako grupa
            for (const ex of scenario.examples) {
              const groupId = buildNodeId(featureNode.uri!, ex.name || scenario.name);
              const groupNode: HierarchyNode = {
                id: groupId,
                name: ex.name || scenario.name,
                children: [],
                uri,
                line: ex.tableHeader.location.line,
              };
              if (ex.tableBody) {
                for (let idx = 0; idx < ex.tableBody.length; idx++) {
                  const exampleId = buildNodeId(
                    featureNode.uri!,
                    `${scenario.name} [Example ${idx + 1}]`
                  );
                  groupNode.children.push({
                    id: exampleId,
                    name: `${scenario.name} [Example ${idx + 1}]`,
                    uri,
                    line: ex.tableBody[idx].location.line,
                    children: [],
                  });
                }
              }
              featureNode.children.push(groupNode);
            }
          } else {
            // Zwykły scenariusz
            const scenarioId = buildNodeId(featureNode.uri!, scenario.name);
            featureNode.children.push({
              id: scenarioId,
              name: scenario.name,
              uri,
              line: scenario.location.line,
              children: [],
            });
          }
        }
      }
    }
  }

  return root;
}
