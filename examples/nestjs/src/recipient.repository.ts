import { Injectable } from '@nestjs/common';
import { RecipientRecord } from './contracts';

@Injectable()
export class RecipientRepository {
  private readonly recipients = new Map<string, RecipientRecord>();

  async findActive(recipientRef: string): Promise<RecipientRecord | null> {
    const existing = this.recipients.get(recipientRef);
    if (existing) return existing.active ? existing : null;

    // Synthetic DB-backed record for this public example.
    const publicExample: RecipientRecord = {
      recipientRef,
      deviceToken: `public-example-device-token-${this.recipients.size + 1}`,
      active: true,
    };
    this.recipients.set(recipientRef, publicExample);
    return publicExample;
  }

  async deactivateDeviceToken(deviceToken: string): Promise<void> {
    for (const [recipientRef, record] of this.recipients.entries()) {
      if (record.deviceToken === deviceToken) {
        this.recipients.set(recipientRef, { ...record, active: false });
      }
    }
  }
}
