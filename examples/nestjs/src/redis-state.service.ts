import { Injectable } from '@nestjs/common';
import {
  AccessTokenState,
  BeginDelivery,
  DeliveryRecord,
  DeliveryStatus,
  SendMessageRequest,
} from './contracts';

@Injectable()
export class RedisStateService {
  private readonly deliveries = new Map<string, DeliveryRecord>();
  private readonly badges = new Map<string, number>();
  private accessToken: AccessTokenState | null = null;
  private refreshOwned = false;

  async beginDelivery(request: SendMessageRequest): Promise<BeginDelivery> {
    const fingerprint = JSON.stringify({
      recipientRef: request.recipientRef,
      title: request.title,
      body: request.body,
    });
    const existing = this.deliveries.get(request.messageId);

    if (existing) {
      return existing.fingerprint === fingerprint
        ? { type: 'EXISTING', record: existing }
        : { type: 'CONFLICT' };
    }

    this.deliveries.set(request.messageId, {
      fingerprint,
      status: DeliveryStatus.QUEUED,
      retryable: false,
    });
    return { type: 'NEW' };
  }

  async updateDelivery(
    messageId: string,
    status: DeliveryStatus,
    retryable: boolean,
    reason?: string,
  ): Promise<void> {
    const existing = this.deliveries.get(messageId);
    if (!existing) throw new Error('delivery must be queued before it is updated');
    this.deliveries.set(messageId, { ...existing, status, retryable, reason });
  }

  async readBadge(recipientRef: string): Promise<number> {
    return this.badges.get(recipientRef) ?? 0;
  }

  async writeBadge(recipientRef: string, badge: number): Promise<void> {
    this.badges.set(recipientRef, badge);
  }

  async readAccessToken(): Promise<AccessTokenState | null> {
    return this.accessToken;
  }

  async writeAccessToken(token: AccessTokenState): Promise<void> {
    this.accessToken = token;
  }

  async tryStartAccessTokenRefresh(): Promise<boolean> {
    // A real Redis adapter would use an atomic SET NX operation with expiry.
    if (this.refreshOwned) return false;
    this.refreshOwned = true;
    return true;
  }

  async finishAccessTokenRefresh(): Promise<void> {
    this.refreshOwned = false;
  }
}
