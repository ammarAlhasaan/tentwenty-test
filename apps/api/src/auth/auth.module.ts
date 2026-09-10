import { Logger, Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

const DEMO_USER_EMAIL = 'demo@tentwenty.local';
const DEMO_USER_PASSWORD = 'demo-password-2026';

@Module({
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule implements OnModuleInit {
  private readonly logger = new Logger(AuthModule.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Clears sessions that expired while the process was down. Opportunistic
    // deletion in the store handles the rest, so no timer is needed.
    await this.prisma.session.deleteMany({ where: { expiresAt: { lte: BigInt(Date.now()) } } });

    await this.seedDemoUser();
  }

  private async seedDemoUser(): Promise<void> {
    // Never in production, and never over an existing user table -- which is
    // what makes running this on every start idempotent.
    if (this.config.getOrThrow<string>('NODE_ENV') === 'production') return;
    if ((await this.auth.countUsers()) > 0) return;

    await this.auth.createUser(DEMO_USER_EMAIL, DEMO_USER_PASSWORD);

    // The email only. The password is in apps/api/README.md, not in the log.
    this.logger.log(`Seeded demo user ${DEMO_USER_EMAIL} (password is in apps/api/README.md)`);
  }
}
