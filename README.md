# vscode-cucumber-js-test-runner.

# Cucumber.js Test Runner for VS Code

This VS Code extension allows you to run Cucumber.js tests directly from your editor.

## Features

- Run individual Cucumber.js feature files
- Run all Cucumber.js tests in your project
- Configurable features directory path
- Test execution time tracking
- Test output display in the Testing panel

## Requirements

- Node.js installed on your system
- Cucumber.js installed in your project (`npm install @cucumber/cucumber`)

## Usage

1. Open a Cucumber feature file (`.feature`)
2. Use the Testing panel to:
   - Run individual tests
   - Run all tests
   - View test results and execution time
   - See test output

## Configuration

You can configure the extension in VS Code settings:

- `cucumberJsTestRunner.featuresPath`: Path to your Cucumber.js features directory (default: "features")

## Development

1. Clone this repository
2. Run `npm install`
3. Press F5 to start debugging

## License

MIT
