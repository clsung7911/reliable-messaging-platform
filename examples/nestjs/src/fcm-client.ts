import { Injectable } from '@nestjs/common';
import { AccessTokenState, FcmResponse, RecipientRecord } from './contracts';

@Injectable()
export class FcmClient {
  async send(
    _recipient: RecipientRecord,
    _accessToken: AccessTokenState,
    _payload: { title: string; body: string; badge: number },
  ): Promise<FcmResponse> {
    // A test double can return UNREGISTERED or an error to exercise each branch.
    return { type: 'ACCEPTED' };
  }
}
