import type { Request } from "express";
import type { AuthProvider, AuthProviderConfig, AuthInitiateResult, AuthCallbackResult } from "./providers";

export class LocalAuthProvider implements AuthProvider {
  readonly type = "local";

  async initiateLogin(_req: Request, _config: AuthProviderConfig): Promise<AuthInitiateResult> {
    throw new Error("Local auth does not use redirect-based login");
  }

  async handleCallback(_req: Request, _config: AuthProviderConfig): Promise<AuthCallbackResult> {
    throw new Error("Local auth does not use callback-based login");
  }
}
