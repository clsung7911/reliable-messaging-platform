import { Injectable } from '@nestjs/common';
import {
  AccessTokenState,
  BeginDelivery,
  DeliveryRecord,
  DeliveryStatus,
  RecipientState,
  SendMessageRequest,
} from './contracts';

@Injectable()
export class RedisStateService {
  private readonly deliveries = new Map<string, DeliveryRecord>();
  private readonly recipients = new Map<string, RecipientState>();
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
      deliveryUnknown: false,
    });
    return { type: 'NEW' };
  }

  async updateDelivery(
    messageId: string,
    status: DeliveryStatus,
    retryable: boolean,
    deliveryUnknown: boolean,
    reason?: string,
  ): Promise<void> {
    const existing = this.deliveries.get(messageId);
    if (!existing) throw new Error('delivery must be queued before update');

    this.deliveries.set(messageId, {
      ...existing,
      status,
      retryable,
      deliveryUnknown,
      reason,
    });
  }

  async findRecipient(recipientRef: string): Promise<RecipientState | null> {
    const existing = this.recipients.get(recipientRef);
    if (existing) return existing;

    const publicExample: RecipientState = {
      recipientRef,
      deviceToken: `public-example-device-token-${this.recipients.size + 1}`,
      active: true,
      badge: 0,
    };
    this.recipients.set(recipientRef, publicExample);
    return publicExample;
  }

  async deactivateDeviceToken(deviceToken: string): Promise<void> {
    for (const [recipientRef, state] of this.recipients.entries()) {
      if (state.deviceToken === deviceToken) {
        this.recipients.set(recipientRef, { ...state, active: false });
      }
    }
  }

  async readAccessToken(): Promise<AccessTokenState | null> {
    return this.accessToken;
  }

  async writeAccessToken(token: AccessTokenState): Promise<void> {
    this.accessToken = token;
  }

  async tryStartAccessTokenRefresh(): Promise<boolean> {
    // A real Redis adapter would use an atomic lock with expiry.
    if (this.refreshOwned) return false;
    this.refreshOwned = true;
    return true;
  }

  async finishAccessTokenRefresh(): Promise<void> {
    this.refreshOwned = false;
  }
}
