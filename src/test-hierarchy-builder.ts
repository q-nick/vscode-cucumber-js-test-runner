import { logDevelopment } from './utilities';
import { GherkinDocument, Pickle } from './zod-schemas';

export interface HierarchyNode {
  id: string;
  name: string;
  children: HierarchyNode[];
  uri?: string;
  line?: number;
}

export function buildNodeId(parentId: string, name: string): string {
  const safeName = name.replaceAll(/\s+/g, '_');
  const normalizedParentId = parentId.replaceAll('\\', '/');
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
    const normalizedUri = uri.replaceAll('\\', '/');
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
              const exampleName = ex.name || scenario.name;
              logDevelopment('ex', ex);
              const groupId = buildNodeId(featureNode.uri!, exampleName);
              const groupNode: HierarchyNode = {
                id: groupId,
                name: exampleName,
                children: [],
                uri,
                line: ex.tableHeader.location.line,
              };
              if (ex.tableBody) {
                for (let index = 0; index < ex.tableBody.length; index++) {
                  logDevelopment('tb', ex, index, ex.tableBody[index]);
                  const name = `${exampleName}:${ex.tableBody[index].location.line}`;
                  const id = buildNodeId(featureNode.uri!, name);
                  groupNode.children.push({
                    id,
                    name,
                    uri,
                    line: ex.tableBody[index].location.line,
                    children: [],
                  });
                }
              }
              featureNode.children.push(groupNode);
            }
          } else {
            // Zwykły scenariusz
            const scenarioId = `${featureNode.uri}:${scenario.location.line}`;
            featureNode.children.push({
              id: scenarioId,
              name: scenario.name,
              uri: featureNode.uri as string,
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

export function buildTestHierarchyFromPickles(
  pickles: Pickle[],
  gherkinDocuments: GherkinDocument[]
): HierarchyNode {
  const root: HierarchyNode = { id: 'root', name: 'root', children: [] };
  const folderMap: Record<string, HierarchyNode> = { root };

  // Zbuduj mapę astNodeId -> { uri, line, name }
  const astNodeIdToLocation: Record<string, { uri: string; line: number; name: string }> = {};

  // Helper function to add location mapping
  const addLocationMapping = (id: string, uri: string, line: number, name: string) => {
    astNodeIdToLocation[id] = { uri, line, name };
  };

  // Build astNodeId mapping
  for (const document of gherkinDocuments) {
    const { uri, feature } = document;
    if (!feature) {
      continue;
    }

    for (const child of feature.children) {
      if (child.scenario) {
        const { scenario } = child;
        addLocationMapping(scenario.id, uri, scenario.location.line, scenario.name);

        if (scenario.examples) {
          for (const ex of scenario.examples) {
            addLocationMapping(ex.id, uri, ex.location.line, ex.name || scenario.name);

            if (ex.tableBody) {
              for (const row of ex.tableBody) {
                addLocationMapping(
                  row.id,
                  uri,
                  row.location.line,
                  `${ex.name || scenario.name}:${row.location.line}`
                );
              }
            }
          }
        }
      }
      if (child.background) {
        const { background } = child;
        addLocationMapping(background.id, uri, background.location.line, background.name);
      }
    }
  }

  // Helper function to create folder hierarchy
  const createFolderHierarchy = (uri: string): HierarchyNode => {
    const normalizedUri = uri.replaceAll('\\', '/');
    const parts = normalizedUri.split('/');
    const filename = parts.pop()!;

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

    // Create feature node
    const featureId = buildNodeId(parentId, filename);
    const featureNode: HierarchyNode = {
      id: featureId,
      name: filename,
      children: [],
      uri,
    };
    parentNode.children.push(featureNode);

    return featureNode;
  };

  // Helper function to get line from astNodeId
  const getLineFromAstNodeId = (astNodeId: string): number | undefined => {
    return astNodeIdToLocation[astNodeId]?.line;
  };

  // Helper function to create scenario node
  const createScenarioNode = (pickle: Pickle, uri: string): HierarchyNode => {
    const line = pickle.astNodeIds?.[0] ? getLineFromAstNodeId(pickle.astNodeIds[0]) : undefined;
    return {
      id: `${uri}:${line ?? ''}`,
      name: pickle.name,
      uri,
      ...(line !== undefined ? { line } : {}),
      children: [],
    };
  };

  // Helper function to create outline node
  const createOutlineNode = (scenarioPickles: Pickle[], uri: string): HierarchyNode => {
    const outlinePickle = scenarioPickles[0];
    const firstAstNodeId = outlinePickle.astNodeIds?.[0];
    const loc = firstAstNodeId ? astNodeIdToLocation[firstAstNodeId] : undefined;

    const outlineNode: HierarchyNode = {
      id: `${uri}:${loc?.line ?? ''}`,
      name: loc?.name || outlinePickle.name,
      children: [],
      uri,
      ...(loc?.line !== undefined ? { line: loc.line } : {}),
    };

    // Add child pickles
    for (const pickle of scenarioPickles) {
      const lastAstNodeId = pickle.astNodeIds?.at(-1);
      const line = lastAstNodeId ? getLineFromAstNodeId(lastAstNodeId) : undefined;

      outlineNode.children.push({
        id: `${uri}:${line ?? ''}`,
        name: pickle.name,
        uri,
        ...(line !== undefined ? { line } : {}),
        children: [],
      });
    }

    return outlineNode;
  };

  // Group pickles by URI
  const picklesByUri: Record<string, Pickle[]> = {};
  for (const pickle of pickles) {
    (picklesByUri[pickle.uri] ??= []).push(pickle);
  }

  // Process each URI
  for (const [uri, uriPickles] of Object.entries(picklesByUri)) {
    const featureNode = createFolderHierarchy(uri);

    // Group pickles by common astNodeIds
    const picklesByAstNodeIds: Record<string, Pickle[]> = {};

    for (const pickle of uriPickles) {
      if (!pickle.astNodeIds?.length) {
        // Pickle without astNodeIds - treat as single scenario
        (picklesByAstNodeIds[`single_${pickle.name}`] ??= []).push(pickle);
        continue;
      }

      // For scenario outline, pickles have common astNodeIds (scenario + examples)
      // but different tableBody row astNodeIds
      const commonAstNodeIds = pickle.astNodeIds.slice(0, -1).sort().join(',');
      const key = commonAstNodeIds || `single_${pickle.name}`;
      (picklesByAstNodeIds[key] ??= []).push(pickle);
    }

    // Create scenario nodes
    for (const scenarioPickles of Object.values(picklesByAstNodeIds)) {
      if (scenarioPickles.length > 1) {
        // Scenario Outline
        featureNode.children.push(createOutlineNode(scenarioPickles, uri));
      } else {
        // Single scenario
        featureNode.children.push(createScenarioNode(scenarioPickles[0], uri));
      }
    }
  }

  return root;
}
