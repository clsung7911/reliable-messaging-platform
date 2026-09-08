import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AccessTokenState } from './contracts';
import { RedisStateService } from './redis-state.service';

@Injectable()
export class AccessTokenService {
  private refreshInFlight: Promise<AccessTokenState> | null = null;

  constructor(private readonly redis: RedisStateService) {}

  async getForSend(): Promise<AccessTokenState> {
    const current = await this.redis.readAccessToken();
    if (current && current.expiresAt.getTime() > Date.now()) return current;

    // Normal send code does not issue an external OAuth request here.
    throw new ServiceUnavailableException('FCM access token is unavailable');
  }

  async refresh(
    _reason: 'startup' | 'scheduled' | 'watchdog' | 'emergency',
  ): Promise<AccessTokenState> {
    if (this.refreshInFlight) return this.refreshInFlight;

    this.refreshInFlight = this.refreshOnce().finally(() => {
      this.refreshInFlight = null;
    });
    return this.refreshInFlight;
  }

  private async refreshOnce(): Promise<AccessTokenState> {
    const ownsRefresh = await this.redis.tryStartAccessTokenRefresh();
    if (!ownsRefresh) {
      const refreshedByOtherInstance = await this.redis.readAccessToken();
      if (refreshedByOtherInstance) return refreshedByOtherInstance;
      throw new ServiceUnavailableException('another instance owns token refresh');
    }

    try {
      // Public placeholder for the external OAuth call. The lifetime is synthetic.
      const next: AccessTokenState = {
        value: 'public-example-access-token',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      };
      await this.redis.writeAccessToken(next);
      return next;
    } finally {
      await this.redis.finishAccessTokenRefresh();
    }
  }
}
