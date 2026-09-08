import { Injectable } from '@nestjs/common';
import { AccessTokenService } from './access-token.service';
import {
  DeliveryResult,
  DeliveryStatus,
  FcmResponse,
  RecipientState,
  SendMessageRequest,
} from './contracts';
import { FcmClient } from './fcm-client';
import { RedisStateService } from './redis-state.service';

@Injectable()
export class CommonApiService {
  constructor(
    private readonly redis: RedisStateService,
    private readonly accessToken: AccessTokenService,
    private readonly fcm: FcmClient,
  ) {}

  // In production this boundary is reached over HTTP and runs as two instances.
  // messageId is also propagated as an HTTP correlation header there.
  async send(
    request: SendMessageRequest,
    recipient: RecipientState,
  ): Promise<DeliveryResult> {
    let accessToken: Awaited<ReturnType<AccessTokenService['getForSend']>>;
    try {
      accessToken = await this.accessToken.getForSend();
    } catch {
      return this.result(
        request,
        DeliveryStatus.FAILED,
        true,
        false,
        'ACCESS_TOKEN_UNAVAILABLE',
      );
    }

    const first = await this.fcm.send(
      recipient,
      accessToken,
      request,
      request.messageId,
    );

    if (first.type === 'UNREGISTERED') {
      const confirmation = await this.fcm.send(
        recipient,
        accessToken,
        request,
        request.messageId,
      );
      return this.handleUnregisteredConfirmation(
        request,
        recipient,
        confirmation,
      );
    }

    return this.classify(request, first);
  }

  private async handleUnregisteredConfirmation(
    request: SendMessageRequest,
    recipient: RecipientState,
    confirmation: FcmResponse,
  ): Promise<DeliveryResult> {
    if (confirmation.type === 'ACCEPTED') {
      return this.result(request, DeliveryStatus.ACCEPTED, false);
    }

    if (confirmation.type === 'UNREGISTERED') {
      await this.redis.deactivateDeviceToken(recipient.deviceToken);
      return this.result(
        request,
        DeliveryStatus.SKIPPED_UNREGISTERED,
        false,
        false,
        'UNREGISTERED_CONFIRMED',
      );
    }

    // A different confirmation error is not evidence that the token is invalid.
    return this.classify(request, confirmation);
  }

  private classify(
    request: SendMessageRequest,
    response: FcmResponse,
  ): DeliveryResult {
    if (response.type === 'ACCEPTED') {
      return this.result(request, DeliveryStatus.ACCEPTED, false);
    }

    if (response.type === 'UNREGISTERED') {
      // This branch is handled by the confirmation path above.
      return this.result(
        request,
        DeliveryStatus.FAILED,
        false,
        false,
        'UNREGISTERED_REQUIRES_CONFIRMATION',
      );
    }

    if (response.type === 'HTTP_ERROR') {
      if (response.status === 502 || response.status === 504) {
        return this.result(
          request,
          DeliveryStatus.DELIVERY_UNKNOWN,
          false,
          true,
          `HTTP_${response.status}`,
        );
      }

      if (response.status === 500 || response.status === 503) {
        return this.result(
          request,
          DeliveryStatus.FAILED,
          true,
          false,
          `HTTP_${response.status}`,
        );
      }

      return this.result(
        request,
        DeliveryStatus.FAILED,
        false,
        false,
        `HTTP_${response.status}`,
      );
    }

    if (
      response.requestStarted &&
      (response.code === 'TIMEOUT' ||
        response.code === 'ECONNRESET' ||
        response.code === 'OTHER')
    ) {
      return this.result(
        request,
        DeliveryStatus.DELIVERY_UNKNOWN,
        false,
        true,
        response.code,
      );
    }

    if (
      !response.requestStarted &&
      (response.code === 'ECONNREFUSED' ||
        response.code === 'ENOTFOUND' ||
        response.code === 'EAI_AGAIN')
    ) {
      return this.result(
        request,
        DeliveryStatus.FAILED,
        true,
        false,
        response.code,
      );
    }

    return this.result(
      request,
      DeliveryStatus.FAILED,
      false,
      false,
      response.code,
    );
  }

  private result(
    request: SendMessageRequest,
    status: DeliveryStatus,
    retryable: boolean,
    deliveryUnknown = false,
    reason?: string,
  ): DeliveryResult {
    return {
      messageId: request.messageId,
      status,
      retryable,
      deliveryUnknown,
      reason,
    };
  }
}
