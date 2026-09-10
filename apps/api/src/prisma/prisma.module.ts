import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

// Global for the same reason DatabaseModule was: every feature module needs it
// and re-importing it in each one adds noise without adding clarity.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
