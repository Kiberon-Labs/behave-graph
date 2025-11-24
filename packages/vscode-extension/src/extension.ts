// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { GraphProvider } from './graphProvider.js';
import { execGraph } from './commands/exec.js';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "kiberon-labs-behave-graph" is now active!'
  );
  context.subscriptions.push(GraphProvider.register(context));

  /**
   * Performs a single execution of the graph
   */
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'kiberon-labs-behave-graph.executeGraph',
      async function (uri) {
        const data = await vscode.workspace.fs.readFile(uri);
        const text = new TextDecoder().decode(data);

        const result = await execGraph({
          graphjson: text,
          programOptions: {
            limitSeconds: 10
          }
        });

        //Create a new tab and display the result
        const document = await vscode.workspace.openTextDocument({
          content: JSON.stringify(result, null, 2),
          language: 'json'
        });
        await vscode.window.showTextDocument(document);
      }
    )
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
