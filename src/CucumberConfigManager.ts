import * as fs from 'fs';
import * as path from 'path';
import { load, dump } from 'js-yaml';
import { pathToFileURL } from 'url';

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

async function parseCucumberConfig(filePath: string, ext: string): Promise<any> {
  if (ext === '.js' || ext === '.cjs') {
    // CommonJS require
    delete require.cache[require.resolve(filePath)];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require(filePath);
  } else if (ext === '.mjs') {
    // ESM dynamic import
    const imported = await import(pathToFileURL(filePath).href);
    // Prefer default export
    return imported.default || imported;
  } else {
    const fileContent = await fs.promises.readFile(filePath, 'utf8');
    if (ext === '.json') {
      try {
        return JSON.parse(fileContent);
      } catch (e) {
        throw new Error(`Nie można sparsować pliku ${filePath} jako JSON: ${(e as Error).message}`);
      }
    } else if (ext === '.yaml' || ext === '.yml') {
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
  ext: string,
  config: any,
  outFileName?: string
): Promise<string> {
  const outName = outFileName || `cucumber${ext}-test-runner${ext}`;
  const outPath = path.join(rootPath, outName);
  let outContent = '';
  if (ext === '.json') {
    outContent = JSON.stringify(config, null, 2);
  } else if (ext === '.js' || ext === '.cjs') {
    outContent = 'module.exports = ' + JSON.stringify(config, null, 2) + ';\n';
  } else if (ext === '.mjs') {
    outContent = 'export default ' + JSON.stringify(config, null, 2) + ';\n';
  } else if (ext === '.yaml' || ext === '.yml') {
    outContent = dump(config);
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
