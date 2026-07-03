export type BYOKPromptReason = 'preview' | 'download' | 'decrypt' | 'editor';

export interface EphemeralBYOKPromptRequest {
  fileName?: string;
  reason?: BYOKPromptReason;
  title?: string;
  description?: string;
}

type EphemeralBYOKPromptHandler = (
  request: EphemeralBYOKPromptRequest
) => Promise<string | null>;

let promptHandler: EphemeralBYOKPromptHandler | null = null;

export function registerEphemeralBYOKPromptHandler(
  handler: EphemeralBYOKPromptHandler | null
): () => void {
  promptHandler = handler;

  return () => {
    if (promptHandler === handler) {
      promptHandler = null;
    }
  };
}

export async function requestEphemeralBYOKKey(
  request: EphemeralBYOKPromptRequest = {}
): Promise<string | null> {
  if (!promptHandler) {
    return null;
  }

  return promptHandler(request);
}

// --- Key Selection Prompt ---

export interface KeySelectionRequest {
  fileName: string;
  fileSize: number;
}

export type KeySelectionMode = 'saved' | 'unique' | 'custom';

export interface KeySelectionResult {
  mode: KeySelectionMode;
  customKey?: string;
  dontAskAgain: boolean;
}

type KeySelectionHandler = (
  request: KeySelectionRequest
) => Promise<KeySelectionResult | null>;

let keySelectionHandler: KeySelectionHandler | null = null;

export function registerKeySelectionHandler(
  handler: KeySelectionHandler | null
): () => void {
  keySelectionHandler = handler;

  return () => {
    if (keySelectionHandler === handler) {
      keySelectionHandler = null;
    }
  };
}

export async function requestKeySelection(
  request: KeySelectionRequest
): Promise<KeySelectionResult | null> {
  if (!keySelectionHandler) {
    return null;
  }

  return keySelectionHandler(request);
}

// --- Mandatory BYOK Setup Prompt ---

type MandatoryBYOKSetupHandler = () => Promise<boolean>;

let mandatorySetupHandler: MandatoryBYOKSetupHandler | null = null;

export function registerMandatoryBYOKSetupHandler(
  handler: MandatoryBYOKSetupHandler | null
): () => void {
  mandatorySetupHandler = handler;

  return () => {
    if (mandatorySetupHandler === handler) {
      mandatorySetupHandler = null;
    }
  };
}

export async function requestMandatoryBYOKSetup(): Promise<boolean> {
  if (!mandatorySetupHandler) {
    return false;
  }

  return mandatorySetupHandler();
}
