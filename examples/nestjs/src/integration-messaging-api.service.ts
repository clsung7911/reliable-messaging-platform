import { Injectable } from '@nestjs/common';
import { CommonApiService } from './common-api.service';
import {
  CommonSendOutcome,
  DeliveryResult,
  DeliveryStatus,
  SendMessageRequest,
} from './contracts';
import { RecipientRepository } from './recipient.repository';
import { RedisStateService } from './redis-state.service';

@Injectable()
export class IntegrationMessagingApiService {
  constructor(
    private readonly redis: RedisStateService,
    private readonly recipients: RecipientRepository,
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
            reason: 'UNEXPECTED_SEND_ERROR',
          },
    );
  }

  private async sendOne(request: SendMessageRequest): Promise<DeliveryResult> {
    const begin = await this.redis.beginDelivery(request);
    if (begin.type === 'CONFLICT') {
      return this.result(request, DeliveryStatus.FAILED, false, 'MESSAGE_ID_CONFLICT');
    }
    if (begin.type === 'EXISTING') {
      return {
        messageId: request.messageId,
        status: begin.record.status,
        retryable: begin.record.retryable,
        reason: begin.record.reason,
        duplicate: true,
      };
    }

    const recipient = await this.recipients.findActive(request.recipientRef);
    if (!recipient) {
      return this.record(request, DeliveryStatus.SKIPPED, false, 'NO_ACTIVE_DEVICE');
    }

    const badge = await this.redis.readBadge(request.recipientRef);
    const outcome = await this.commonApi.send(request, recipient, badge);
    return this.applyOutcome(request, recipient.deviceToken, badge, outcome);
  }

  private async applyOutcome(
    request: SendMessageRequest,
    deviceToken: string,
    currentBadge: number,
    outcome: CommonSendOutcome,
  ): Promise<DeliveryResult> {
    if (outcome.type === 'DELIVERED') {
      await this.redis.writeBadge(request.recipientRef, currentBadge + 1);
      return this.record(request, DeliveryStatus.DELIVERED, false);
    }

    if (outcome.type === 'UNREGISTERED_CONFIRMED') {
      await this.recipients.deactivateDeviceToken(deviceToken);
      // Sender-level intent is non-retryable/skipped. The real upper retry queue
      // still has a documented status-branching gap; this example stops here.
      return this.record(
        request,
        DeliveryStatus.SKIPPED,
        false,
        'UNREGISTERED_CONFIRMED',
      );
    }

    return this.record(
      request,
      DeliveryStatus.FAILED,
      outcome.type === 'FAILED_RETRYABLE',
      outcome.reason,
    );
  }

  private async record(
    request: SendMessageRequest,
    status: DeliveryStatus,
    retryable: boolean,
    reason?: string,
  ): Promise<DeliveryResult> {
    await this.redis.updateDelivery(request.messageId, status, retryable, reason);
    return this.result(request, status, retryable, reason);
  }

  private result(
    request: SendMessageRequest,
    status: DeliveryStatus,
    retryable: boolean,
    reason?: string,
  ): DeliveryResult {
    return { messageId: request.messageId, status, retryable, reason };
  }
}
