import { Injectable } from '@nestjs/common';
import { CommonApiService } from './common-api.service';
import {
  DeliveryResult,
  DeliveryStatus,
  SendMessageRequest,
} from './contracts';
import { RedisStateService } from './redis-state.service';

@Injectable()
export class IntegrationMessagingApiService {
  constructor(
    private readonly redis: RedisStateService,
    private readonly commonApi: CommonApiService,
  ) {}

  async sendBatch(requests: SendMessageRequest[]): Promise<DeliveryResult[]> {
    const settled = await Promise.allSettled(
      requests.map((request) => this.sendOne(request)),
    );

    return settled.map((item, index) =>
      item.status === 'fulfilled'
        ? item.value
        : {
            messageId: requests[index].messageId,
            status: DeliveryStatus.FAILED,
            retryable: true,
            deliveryUnknown: false,
            reason: 'UNEXPECTED_INTEGRATION_ERROR',
          },
    );
  }

  private async sendOne(request: SendMessageRequest): Promise<DeliveryResult> {
    const begin = await this.redis.beginDelivery(request);

    if (begin.type === 'CONFLICT') {
      return this.result(
        request,
        DeliveryStatus.FAILED,
        false,
        false,
        'MESSAGE_ID_CONFLICT',
      );
    }

    if (begin.type === 'EXISTING') {
      return {
        messageId: request.messageId,
        status: begin.record.status,
        retryable: begin.record.retryable,
        deliveryUnknown: begin.record.deliveryUnknown,
        reason: begin.record.reason,
        duplicate: true,
      };
    }

    const recipient = await this.redis.findRecipient(request.recipientRef);
    if (!recipient || !recipient.active) {
      // The real system also has pre-send skip cases. This sample keeps them
      // outside the FCM-provider outcome taxonomy to stay focused.
      return this.record(
        request,
        DeliveryStatus.FAILED,
        false,
        false,
        'NO_ACTIVE_DEVICE',
      );
    }

    // Production uses an HTTP call and propagates messageId as X-Message-Id.
    const outcome = await this.commonApi.send(request, recipient);

    // Only clear retryable failures should enter an upstream retry mechanism.
    // delivery_unknown is deliberately non-retryable.
    return this.record(
      request,
      outcome.status,
      outcome.retryable,
      outcome.deliveryUnknown ?? false,
      outcome.reason,
    );
  }

  private async record(
    request: SendMessageRequest,
    status: DeliveryStatus,
    retryable: boolean,
    deliveryUnknown: boolean,
    reason?: string,
  ): Promise<DeliveryResult> {
    await this.redis.updateDelivery(
      request.messageId,
      status,
      retryable,
      deliveryUnknown,
      reason,
    );
    return this.result(
      request,
      status,
      retryable,
      deliveryUnknown,
      reason,
    );
  }

  private result(
    request: SendMessageRequest,
    status: DeliveryStatus,
    retryable: boolean,
    deliveryUnknown: boolean,
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
