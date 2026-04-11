import type { MailConnector } from "@shared/schema";
import type {
  ConnectorService,
  ConnectorCredentials,
  FetchedEmail,
} from "./types";

export class ForwardingConnectorService implements ConnectorService {
  readonly provider = "forwarding" as const;

  async testConnection(_connector: MailConnector, _credentials: ConnectorCredentials) {
    return { success: true };
  }

  async fetchEmails(
    _connector: MailConnector,
    _credentials: ConnectorCredentials,
    _inboundAlias: string,
    _maxMessages?: number,
  ): Promise<FetchedEmail[]> {
    return [];
  }

  async markProcessed(
    _connector: MailConnector,
    _credentials: ConnectorCredentials,
    _uids: (number | string)[],
  ): Promise<void> {
  }
}
