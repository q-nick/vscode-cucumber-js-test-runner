import * as fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { dump, load } from 'js-yaml';

// Nie usuwaj tego komentarza: Util do czyszczenia configu cucumber-js

const configFilenames = [
  'cucumber.js',
  'cucumber.cjs',
  'cucumber.mjs',
  'cucumber.json',
  'cucumber.yaml',
  'cucumber.yml',
];

function findCucumberConfigFile(rootPath: string): { path: string; ext: string } | undefined {
  for (const filename of configFilenames) {
    const filePath = path.join(rootPath, filename);
    if (fs.existsSync(filePath)) {
      return { path: filePath, ext: path.extname(filePath).toLowerCase() };
    }
  }
  return undefined;
}

async function parseCucumberConfig(filePath: string, extension: string): Promise<any> {
  if (extension === '.js' || extension === '.cjs') {
    // CommonJS require - using dynamic import instead
    const imported = await import(pathToFileURL(filePath).href);
    return imported.default || imported;
  } else if (extension === '.mjs') {
    // ESM dynamic import
    const imported = await import(pathToFileURL(filePath).href);
    // Prefer default export
    return imported.default || imported;
  } else {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    if (extension === '.json') {
      try {
        return JSON.parse(fileContent);
      } catch (error) {
        throw new Error(
          `Nie można sparsować pliku ${filePath} jako JSON: ${(error as Error).message}`
        );
      }
    } else if (extension === '.yaml' || extension === '.yml') {
      return load(fileContent);
    }
  }
  return {};
}

function extractDefaultAndRemovePaths(config: any): any {
  if (config && typeof config === 'object' && 'default' in config) {
    const result = { default: { ...config.default } };
    if (result.default && typeof result.default === 'object' && 'paths' in result.default) {
      delete result.default.paths;
      delete result.default.format;
    }
    return result;
  }
  return {};
}

async function writeConfigFile(
  rootPath: string,
  extension: string,
  config: any,
  outFileName?: string
): Promise<string> {
  const outName = outFileName || `cucumber${extension}-test-runner${extension}`;
  const outPath = path.join(rootPath, outName);
  let outContent = '';
  switch (extension) {
    case '.json': {
      outContent = JSON.stringify(config, undefined, 2);

      break;
    }
    case '.js':
    case '.cjs': {
      outContent = 'module.exports = ' + JSON.stringify(config, undefined, 2) + ';\n';

      break;
    }
    case '.mjs': {
      outContent = 'export default ' + JSON.stringify(config, undefined, 2) + ';\n';

      break;
    }
    case '.yaml':
    case '.yml': {
      outContent = dump(config);

      break;
    }
    // No default
  }
  await fs.promises.writeFile(outPath, outContent, 'utf8');
  return outPath;
}

export async function cleanAndCopyCucumberConfigAsync(
  rootPath: string,
  outFileName?: string
): Promise<string | undefined> {
  const found = findCucumberConfigFile(rootPath);
  if (!found) {
    return undefined;
  }
  const { path: configPath, ext } = found;
  const loaded = await parseCucumberConfig(configPath, ext);
  const cleaned = extractDefaultAndRemovePaths(loaded);
  return await writeConfigFile(rootPath, ext, cleaned, outFileName);
}
