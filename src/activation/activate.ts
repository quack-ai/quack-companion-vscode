// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { v4 } from "uuid";

import { getExtensionVersion } from "./environmentSetup";
import { ChatViewProvider } from "../webviews/chatView";
import { verifyQuackEndpoint } from "../util/quack";
import { setEndpoint, login, logout } from "../commands/authentication";
import { getEnvInfo } from "../commands/diagnostics";
import { sendChatMessage } from "../commands/assistant";

export let extensionContext: vscode.ExtensionContext | undefined = undefined;
export let sessionId: string = v4();

export async function activateExtension(context: vscode.ExtensionContext) {
  extensionContext = context;

  // Logs
  console.log("Using Quack Companion version: ", getExtensionVersion());
  try {
    console.log(
      "In workspace: ",
      vscode.workspace.workspaceFolders?.[0].uri.fsPath,
    );
  } catch (e) {
    console.log("Error getting workspace folder: ", e);
  }
  console.log("Session ID: ", sessionId);

  // Sidebar
  const provider = new ChatViewProvider(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("quack.chatView", provider),
  );
  // Register commands and providers
  // Diagnostics
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.getEnvInfo", getEnvInfo),
  );
  // Authentication
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.setEndpoint", async () => {
      await setEndpoint(context);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.login", async () => {
      await login(context);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.logout", async () => {
      await logout(context);
    }),
  );
  // Chat
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack.sendChatMessage",
      async (input?: string) => {
        await sendChatMessage(context, input);
      },
    ),
  );
  // Safety checks
  let config = vscode.workspace.getConfiguration("api");
  // Validate endpoint
  const isValidEndpoint: boolean = await verifyQuackEndpoint(
    config.get("endpoint") as string,
  );
  if (!isValidEndpoint) {
    vscode.window
      .showErrorMessage("Invalid API endpoint", "Configure endpoint")
      .then((choice) => {
        if (choice === "Configure endpoint") {
          vscode.commands.executeCommand("quack.setEndpoint");
        }
      });
  }

  // // Commands to be run when activating
  if (context.globalState.get("quack.quackToken")) {
    //
  }
  // Refresh state
  vscode.commands.executeCommand(
    "setContext",
    "quack.isAuthenticated",
    !!context.globalState.get("quack.quackToken"),
  );
}
