import * as vscode from 'vscode';
import { CucumberJsTestController } from './CucumberJsTestController';

export function activate(context: vscode.ExtensionContext) {
  console.log('cucumber-js Test Runner is now active!');

  const controller = new CucumberJsTestController();

  context.subscriptions.push(
    controller.vscodeTestController,
    vscode.workspace.onDidChangeWorkspaceFolders(() => controller.initializeWorkspace()),
    vscode.commands.registerCommand('cucumber-js-test-runner.refreshTests', () => {
      controller.refresh();
    })
  );

  // Add Run Profile for running tests from the Test Explorer
  const runProfile = controller.vscodeTestController.createRunProfile(
    'Run',
    vscode.TestRunProfileKind.Run,
    (request, token) => {
      controller.runTests(request, token);
    },
    true // isDefault
  );
  context.subscriptions.push(runProfile);

  // Add Debug Profile for debugging tests from the Test Explorer
  const debugProfile = controller.vscodeTestController.createRunProfile(
    'Debug',
    vscode.TestRunProfileKind.Debug,
    (request, token) => {
      controller.runTests(request, token); // Możesz dodać osobną metodę, jeśli debugowanie wymaga innej logiki
    },
    false
  );
  context.subscriptions.push(debugProfile);

  // Add FileSystemWatcher for .feature files
  const featureWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');
  context.subscriptions.push(featureWatcher);
  featureWatcher.onDidCreate(() => controller.discoverTests());
  featureWatcher.onDidDelete(() => controller.discoverTests());

  controller.initializeWorkspace();
  controller.discoverTests();
}

export function deactivate() {}
