import type { MailConnector } from "@shared/schema";
import type {
  ConnectorService,
  ConnectorCredentials,
  FetchedEmail,
  OAuthStartResult,
  OAuthCallbackResult,
} from "./types";
import { fetchUnseenEmails, markMessagesSeen, testImapConnection, type ImapConfig } from "../imapClient";
import crypto from "crypto";

const MS_AUTH_BASE = "https://login.microsoftonline.com";
const MS_TOKEN_PATH = "/oauth2/v2.0/token";
const MS_AUTH_PATH = "/oauth2/v2.0/authorize";
const MS_GRAPH_ME = "https://graph.microsoft.com/v1.0/me";
const TENANT = "common";
const SCOPES = [
  "https://outlook.office365.com/IMAP.AccessAsUser.All",
  "openid",
  "profile",
  "email",
  "offline_access",
];

function getClientId(): string {
  const id = process.env.MICROSOFT_CLIENT_ID;
  if (!id) throw new Error("MICROSOFT_CLIENT_ID not configured");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!secret) throw new Error("MICROSOFT_CLIENT_SECRET not configured");
  return secret;
}

function buildImapConfig(connector: MailConnector, creds: ConnectorCredentials): ImapConfig {
  return {
    host: "outlook.office365.com",
    port: 993,
    user: creds.imapUser || connector.emailAddress || "",
    password: creds.accessToken || "",
    tls: true,
    folder: connector.imapFolder || "INBOX",
    useOAuth: true,
  };
}

export class MicrosoftConnectorService implements ConnectorService {
  readonly provider = "microsoft" as const;

  async startOAuth(_connector: MailConnector, redirectUri: string): Promise<OAuthStartResult> {
    const state = crypto.randomBytes(32).toString("hex");
    const params = new URLSearchParams({
      client_id: getClientId(),
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      response_mode: "query",
      state,
      prompt: "consent",
    });
    return {
      redirectUrl: `${MS_AUTH_BASE}/${TENANT}${MS_AUTH_PATH}?${params.toString()}`,
      state,
    };
  }

  async handleOAuthCallback(
    _connector: MailConnector,
    code: string,
    redirectUri: string,
  ): Promise<OAuthCallbackResult> {
    try {
      const tokenRes = await fetch(`${MS_AUTH_BASE}/${TENANT}${MS_TOKEN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: getClientId(),
          client_secret: getClientSecret(),
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
          scope: SCOPES.join(" "),
        }),
      });

      if (!tokenRes.ok) {
        const errBody = await tokenRes.text();
        console.error("[microsoft-connector] Token exchange failed:", errBody);
        return { success: false, error: "Failed to exchange authorization code" };
      }

      const tokenData = await tokenRes.json() as any;
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;
      const expiresIn = tokenData.expires_in || 3600;

      if (!accessToken) {
        return { success: false, error: "No access token received" };
      }

      let emailAddress = "";
      try {
        const meRes = await fetch(MS_GRAPH_ME, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (meRes.ok) {
          const meData = await meRes.json() as any;
          emailAddress = meData.mail || meData.userPrincipalName || "";
        }
      } catch {}

      return {
        success: true,
        emailAddress,
        credentials: {
          accessToken,
          refreshToken,
          tokenExpiry: Date.now() + expiresIn * 1000,
          imapUser: emailAddress,
        },
      };
    } catch (err: any) {
      console.error("[microsoft-connector] OAuth callback error:", err.message);
      return { success: false, error: "OAuth processing failed" };
    }
  }

  async testConnection(connector: MailConnector, credentials: ConnectorCredentials) {
    const creds = await this.ensureFreshToken(connector, credentials);
    const config = buildImapConfig(connector, creds);
    return testImapConnection(config);
  }

  async fetchEmails(
    connector: MailConnector,
    credentials: ConnectorCredentials,
    inboundAlias: string,
    maxMessages = 20,
  ): Promise<FetchedEmail[]> {
    const creds = await this.ensureFreshToken(connector, credentials);
    const config = buildImapConfig(connector, creds);
    const results = await fetchUnseenEmails(config, inboundAlias, maxMessages);
    return results.map(r => ({ uid: r.uid, email: { ...r.email, provider: "microsoft" } }));
  }

  async markProcessed(
    connector: MailConnector,
    credentials: ConnectorCredentials,
    uids: (number | string)[],
  ): Promise<void> {
    const creds = await this.ensureFreshToken(connector, credentials);
    const config = buildImapConfig(connector, creds);
    await markMessagesSeen(config, uids.map(u => Number(u)));
  }

  async refreshCredentials(
    _connector: MailConnector,
    credentials: ConnectorCredentials,
  ): Promise<ConnectorCredentials | null> {
    if (!credentials.refreshToken) return null;

    try {
      const res = await fetch(`${MS_AUTH_BASE}/${TENANT}${MS_TOKEN_PATH}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: getClientId(),
          client_secret: getClientSecret(),
          refresh_token: credentials.refreshToken,
          grant_type: "refresh_token",
          scope: SCOPES.join(" "),
        }),
      });

      if (!res.ok) return null;

      const data = await res.json() as any;
      return {
        ...credentials,
        accessToken: data.access_token,
        refreshToken: data.refresh_token || credentials.refreshToken,
        tokenExpiry: Date.now() + (data.expires_in || 3600) * 1000,
      };
    } catch {
      return null;
    }
  }

  private async ensureFreshToken(
    connector: MailConnector,
    credentials: ConnectorCredentials,
  ): Promise<ConnectorCredentials> {
    if (credentials.tokenExpiry && credentials.tokenExpiry > Date.now() + 60_000) {
      return credentials;
    }
    const refreshed = await this.refreshCredentials(connector, credentials);
    if (!refreshed) throw new Error("Failed to refresh Microsoft access token");
    return refreshed;
  }
}
