# vscode-cucumber-js-test-runner

<p align="center">
  <img src="https://raw.githubusercontent.com/cucumber/cucumber/main/images/cucumber-logo.png" alt="Cucumber.js" width="120"/>
</p>

<p align="center">
  <b>Cucumber.js Test Runner for VS Code</b><br>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/badge/Node.js-Required-green?logo=node.js" alt="Node.js required"></a>
  <a href="https://www.gnu.org/licenses/gpl-3.0.html"><img src="https://img.shields.io/badge/License-GPLv3-blue.svg" alt="GPLv3"></a>
</p>

---

This VS Code extension allows you to run Cucumber.js tests directly from your editor with zero manual configuration.

## ✨ Features

- 🚀 Run individual Cucumber.js feature files or all tests in your project
- 🌳 Automatic test tree discovery and display
- ⏱️ Test execution time tracking
- 📋 Test output display in the Testing panel
- ⚡ **No need to create a config file manually**

## 🥒 Full Gherkin Support

This extension fully supports the Gherkin language and all its advanced features for Behavior-Driven Development (BDD), including:

- **Scenario Outline**: Write parameterized scenarios with Examples tables
- **Background**: Define common steps for all scenarios in a feature
- **Tags**: Organize and filter your scenarios and features with tags
- **Rules**: Group related scenarios under business rules
- **Examples**: Use multiple sets of data for Scenario Outlines
- **Step Arguments**: Support for Data Tables and DocStrings
- **Comments & Descriptions**: Rich support for documentation within your features
- **Multilingual**: Gherkin keywords in multiple languages

With this extension, you can leverage the full power of Gherkin for expressive, maintainable, and scalable BDD specifications.

## ⚙️ Requirements

- VS Code version 1.59.0 or higher
- Node.js installed on your system
- Cucumber.js (version 7.x or newer) installed in your project (`npm install @cucumber/cucumber`)

> **Compatibility:**
> This extension supports Cucumber.js version 7.x and newer, relying on the official Gherkin AST/messages format introduced in Cucumber.js 7.x.

## 🔧 How It Works & Configuration

You do **not** need to create a Cucumber.js configuration file yourself. The extension automatically detects your project's configuration, generates its own config file based on it, and saves it in your project root every time you run tests.

**The generated config file** (e.g. `cucumber.json-test-runner.json`, `cucumber.js-test-runner.js`, etc.) can be safely added to your `.gitignore` because it is recreated on every test run and does not need to be versioned.

> **Example `.gitignore` entry:**
>
> ```
> cucumber*-test-runner.*
> ```

## 🚦 Usage

1. Open a Cucumber feature file (`.feature`)
2. Use the Testing panel to:
   - Run individual tests
   - Run all tests
   - View test results and execution time
   - See test output

## 📄 License

This project is licensed under the **GNU General Public License v3.0**. See the [LICENSE](./LICENSE) file for details.
