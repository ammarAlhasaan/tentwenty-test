import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { AnalyticsController } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';
import { ProjectsController } from './projects.controller.js';

@Module({
  // SessionAuthGuard injects AuthService, and AuthModule is not global.
  imports: [AuthModule, SettingsModule],
  controllers: [AnalyticsController, ProjectsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
