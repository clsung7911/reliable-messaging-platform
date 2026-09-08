export enum DeliveryStatus {
  QUEUED = 'QUEUED',
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  SKIPPED = 'SKIPPED',
}

export type SendMessageRequest = {
  messageId: string;
  recipientRef: string;
  title: string;
  body: string;
};

export type DeliveryResult = {
  messageId: string;
  status: DeliveryStatus;
  retryable: boolean;
  duplicate?: boolean;
  reason?: string;
};

export type DeliveryRecord = {
  fingerprint: string;
  status: DeliveryStatus;
  retryable: boolean;
  reason?: string;
};

export type RecipientRecord = {
  recipientRef: string;
  deviceToken: string;
  active: boolean;
};

export type AccessTokenState = {
  value: string;
  expiresAt: Date;
};

export type FcmResponse =
  | { type: 'ACCEPTED' }
  | { type: 'UNREGISTERED' }
  | { type: 'RETRYABLE_ERROR'; reason: string }
  | { type: 'PERMANENT_ERROR'; reason: string };

export type CommonSendOutcome =
  | { type: 'DELIVERED' }
  | { type: 'UNREGISTERED_CONFIRMED' }
  | { type: 'FAILED_RETRYABLE'; reason: string }
  | { type: 'FAILED_PERMANENT'; reason: string };

export type BeginDelivery =
  | { type: 'NEW' }
  | { type: 'EXISTING'; record: DeliveryRecord }
  | { type: 'CONFLICT' };
