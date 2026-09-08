export enum DeliveryStatus {
  QUEUED = 'queued',
  ACCEPTED = 'accepted',
  SKIPPED_UNREGISTERED = 'skipped_unregistered',
  DELIVERY_UNKNOWN = 'delivery_unknown',
  FAILED = 'failed',
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
  deliveryUnknown?: boolean;
  duplicate?: boolean;
  reason?: string;
};

export type DeliveryRecord = {
  fingerprint: string;
  status: DeliveryStatus;
  retryable: boolean;
  deliveryUnknown?: boolean;
  reason?: string;
};

export type RecipientState = {
  recipientRef: string;
  deviceToken: string;
  active: boolean;
  badge: number;
};

export type AccessTokenState = {
  value: string;
  expiresAt: Date;
};

export type FcmResponse =
  | { type: 'ACCEPTED' }
  | { type: 'UNREGISTERED' }
  | { type: 'HTTP_ERROR'; status: number }
  | {
      type: 'NETWORK_ERROR';
      code:
        | 'TIMEOUT'
        | 'ECONNREFUSED'
        | 'ENOTFOUND'
        | 'EAI_AGAIN'
        | 'ECONNRESET'
        | 'OTHER';
      requestStarted: boolean;
    };

export type BeginDelivery =
  | { type: 'NEW' }
  | { type: 'EXISTING'; record: DeliveryRecord }
  | { type: 'CONFLICT' };
