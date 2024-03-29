// Copyright (C) 2023-2024, Quack AI.

// This program is licensed under the Apache License 2.0.
// See LICENSE or go to <https://www.apache.org/licenses/LICENSE-2.0> for full license details.

import * as vscode from "vscode";

let config = vscode.workspace.getConfiguration("api");

export interface QuackGuideline {
  id: number;
  content: string;
  creator_id: number;
  created_at: string;
  updated_at: string;
}

export interface ComplianceResult {
  guideline_id: number;
  is_compliant: boolean;
  comment: string;
}

export interface GuidelineCompliance {
  is_compliant: boolean;
  comment: string;
  // suggestion: string;
}

export interface ChatMessage {
  role: string;
  content: string;
}

export interface StreamingMessage {
  model: string;
  created_at: string;
  message: ChatMessage;
  done: boolean;
}

interface QuackToken {
  access_token: string;
}

export async function verifyQuackEndpoint(
  endpointURL: string,
): Promise<boolean> {
  const routeURL: string = new URL(
    "/api/v1/login/validate",
    endpointURL,
  ).toString();
  try {
    const response = await fetch(routeURL);
    if (response.ok) {
      return true;
    } else if (response.status === 401) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    return false;
  }
}

export async function getAPIAccessStatus(
  quackToken: string,
  endpointURL: string,
): Promise<string> {
  const routeURL: string = new URL(
    "/api/v1/login/validate",
    endpointURL,
  ).toString();
  try {
    const response = await fetch(routeURL, {
      headers: { Authorization: `Bearer ${quackToken}` },
    });
    if (response.ok) {
      return "ok"; // Token & endpoint good
    } else if (response.status === 404) {
      return "unknown-route"; // Unknown route
    } else if (response.status === 401) {
      return "expired-token"; // Expired token
    } else {
      return "other"; // Other HTTP status codes
    }
  } catch (error) {
    if (error instanceof Error && error.name === "TypeError") {
      return "unreachable-endpoint"; // Wrong endpoint
    }
    return "other"; // Token or server issues
  }
}

export function checkAPIAccess(context: vscode.ExtensionContext): boolean {
  // API Checks
  if (!config.get("endpoint")) {
    vscode.window.showErrorMessage("Configure your endpoint first");
    context.globalState.update("quack.isValidEndpoint", false);
    vscode.commands.executeCommand(
      "setContext",
      "quack.isValidEndpoint",
      false,
    );
    return false;
  }
  if (!context.globalState.get("quack.quackToken")) {
    vscode.window.showErrorMessage("Authenticate first");
    context.globalState.update("quack.isValidToken", false);
    vscode.commands.executeCommand("setContext", "quack.isValidToken", false);
    return false;
  }
  return true;
}

export async function getToken(
  githubToken: string,
  endpointURL: string,
): Promise<string> {
  const quackURL = new URL("/api/v1/login/token", endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response = await fetch(quackURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        github_token: githubToken,
      }),
    });

    // Handle the response
    if (response.ok) {
      const data = (await response.json()) as QuackToken;
      return data.access_token;
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to authenticate");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Unable to authenticate");
  }
}

export async function fetchGuidelines(
  endpointURL: string,
  token: string,
): Promise<QuackGuideline[]> {
  const quackURL = new URL(`/api/v1/guidelines/`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response = await fetch(quackURL, {
      headers: { Authorization: `Bearer ${token}` },
    });

    // Handle the response
    if (response.ok) {
      return (await response.json()) as QuackGuideline[];
    } else {
      // The request returned a non-200 status code (e.g., 404)
      // Show an error message or handle the error accordingly
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to fetch guidelines");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error fetching repository details:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage(
      "Failed to fetch repository details. Make sure the repository exists and is public.",
    );
    throw new Error("Unable to fetch guidelines");
  }
}

export async function postChatMessage(
  messages: ChatMessage[],
  endpointURL: string,
  token: string,
  onChunkReceived: (chunk: string) => void,
  onEnd: () => void,
): Promise<void> {
  const quackURL = new URL("/api/v1/code/chat", endpointURL).toString();
  try {
    const response = await fetch(quackURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ messages: messages }),
    });

    if (response.body) {
      const reader = response.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          // Assume each chunk is a Uint8Array, convert to a string or otherwise process
          const chunk = new TextDecoder().decode(value);
          // Process the chunk, e.g., assuming JSON content
          onChunkReceived(JSON.parse(chunk).message.content);
        }
        // Stream ended
        onEnd();
      } catch (error) {
        console.error(error);
      } finally {
        reader.releaseLock();
      }
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error sending Quack API request:", error);
    vscode.window.showErrorMessage("Invalid API request.");
    throw new Error("Unable to send chat message");
  }
}

export async function postGuideline(
  content: string,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines`, endpointURL).toString();
  try {
    // Retrieve the guidelines
    const response = await fetch(quackURL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: content }),
    });

    // Handle the response
    if (response.ok) {
      return (await response.json()) as QuackGuideline;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to create guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error creating guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to create guideline.");
    throw new Error("Unable to create guideline");
  }
}

export async function patchGuideline(
  id: number,
  content: string,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines/${id}`, endpointURL).toString();
  try {
    // Update the guideline
    const response = await fetch(quackURL, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content: content }),
    });

    // Handle the response
    if (response.ok) {
      return (await response.json()) as QuackGuideline;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to patch guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error patching guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to patch guideline.");
    throw new Error("Unable to patch guideline");
  }
}

export async function deleteGuideline(
  id: number,
  endpointURL: string,
  token: string,
): Promise<QuackGuideline> {
  const quackURL = new URL(`/api/v1/guidelines/${id}`, endpointURL).toString();
  try {
    // Delete the guideline
    const response = await fetch(quackURL, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    // Handle the response
    if (response.ok) {
      return (await response.json()) as QuackGuideline;
    } else {
      vscode.window.showErrorMessage(
        `Quack API returned status code ${response.status}`,
      );
      throw new Error("Unable to patch guideline");
    }
  } catch (error) {
    // Handle other errors that may occur during the request
    console.error("Error patching guideline:", error);

    // Show an error message or handle the error accordingly
    vscode.window.showErrorMessage("Failed to patch guideline.");
    throw new Error("Unable to patch guideline");
  }
}
