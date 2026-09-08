import { Injectable } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import {
  CommonSendOutcome,
  RecipientRecord,
  SendMessageRequest,
} from './contracts';
import { FcmClient } from './fcm-client';

@Injectable()
export class CommonApiService {
  constructor(
    private readonly accessToken: AccessTokenService,
    private readonly fcm: FcmClient,
  ) {}

  // In the operated structure this API was deployed as two instances.
  // It owns the FCM call and uses the shared access-token lifecycle.
  async send(
    request: SendMessageRequest,
    recipient: RecipientRecord,
    badge: number,
  ): Promise<CommonSendOutcome> {
    let token: Awaited<ReturnType<AccessTokenService['getForSend']>>;
    try {
      token = await this.accessToken.getForSend();
    } catch {
      return { type: 'FAILED_RETRYABLE', reason: 'ACCESS_TOKEN_UNAVAILABLE' };
    }

    const first = await this.trySend(request, recipient, badge, token);
    if (first.type === 'ACCEPTED') return { type: 'DELIVERED' };
    if (first.type === 'RETRYABLE_ERROR') {
      return { type: 'FAILED_RETRYABLE', reason: first.reason };
    }
    if (first.type === 'PERMANENT_ERROR') {
      return { type: 'FAILED_PERMANENT', reason: first.reason };
    }

    // Current sender policy: confirm UNREGISTERED once before deactivation.
    const confirmation = await this.trySend(request, recipient, badge, token);
    if (confirmation.type === 'ACCEPTED') return { type: 'DELIVERED' };
    if (confirmation.type === 'UNREGISTERED') {
      return { type: 'UNREGISTERED_CONFIRMED' };
    }
    if (confirmation.type === 'RETRYABLE_ERROR') {
      return { type: 'FAILED_RETRYABLE', reason: confirmation.reason };
    }
    return { type: 'FAILED_PERMANENT', reason: confirmation.reason };
  }

  private async trySend(
    request: SendMessageRequest,
    recipient: RecipientRecord,
    badge: number,
    token: Awaited<ReturnType<AccessTokenService['getForSend']>>,
  ) {
    try {
      return await this.fcm.send(recipient, token, {
        title: request.title,
        body: request.body,
        badge,
      });
    } catch {
      return { type: 'RETRYABLE_ERROR', reason: 'FCM_REQUEST_ERROR' } as const;
    }
  }
}
