// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";
import { v4 } from "uuid";

import { getExtensionVersion } from "./environmentSetup";
import { ChatViewProvider } from "../webviews/chatView";
import { GuidelineTreeProvider } from "../webviews/guidelineView";
import {
  setEndpoint,
  login,
  logout,
  prepareAPIAccess,
} from "../commands/authentication";
import { getEnvInfo } from "../commands/diagnostics";
import { sendChatMessage } from "../commands/assistant";
import {
  createGuideline,
  listGuidelines,
  editGuideline,
  removeGuideline,
  pullGuidelines,
} from "../commands/guidelines";

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
  const chatViewProvider = new ChatViewProvider(context.extensionUri, context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      "quack.chatView",
      chatViewProvider,
    ),
  );
  const guidelineTreeProvider = new GuidelineTreeProvider(
    context.extensionUri,
    context,
  );
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider(
      "quack.guidelineTreeView",
      guidelineTreeProvider,
    ),
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
        await sendChatMessage(input, context, chatViewProvider);
        chatViewProvider.refresh();
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.clearChatHistory", () => {
      context.workspaceState.update("messages", []);
      chatViewProvider.refresh();
    }),
  );
  // Guideline
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.pullGuidelines", async () => {
      await pullGuidelines(context);
      guidelineTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack.createGuideline",
      async (input?: string) => {
        await createGuideline(input, context);
        guidelineTreeProvider.refresh();
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.listGuidelines", async () => {
      await listGuidelines(context);
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("quack.editGuidelineItem", async (item) => {
      const index = guidelineTreeProvider.getIndexOf(item);
      await editGuideline(index, undefined, context);
      guidelineTreeProvider.refresh();
    }),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "quack.deleteGuidelineItem",
      async (item) => {
        const index = guidelineTreeProvider.getIndexOf(item);
        await removeGuideline(index, context);
        guidelineTreeProvider.refresh();
      },
    ),
  );
  // Refresh UI
  chatViewProvider.refresh();
  guidelineTreeProvider.refresh();
  // Safety checks
  prepareAPIAccess(context);
}
