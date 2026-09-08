import { Injectable } from '@nestjs/common';
import { AccessTokenState, FcmResponse, RecipientState } from './contracts';

@Injectable()
export class FcmClient {
  async send(
    _recipient: RecipientState,
    _accessToken: AccessTokenState,
    _payload: { title: string; body: string },
    _messageId: string,
  ): Promise<FcmResponse> {
    // Public test double. Tests can return timeout/502/UNREGISTERED branches.
    return { type: 'ACCEPTED' };
  }
}
