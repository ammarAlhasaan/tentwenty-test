import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { type PeriodQuery, periodQuerySchema } from './analytics.schema.js';
import { scope } from './analytics.controller.js';
import { AnalyticsService } from './analytics.service.js';

@Controller('projects')
@UseGuards(SessionAuthGuard)
export class ProjectsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  list(@Query({ schema: periodQuerySchema }) query: PeriodQuery) {
    return this.analytics.projectList(scope(query));
  }

  /** Deliberately not period-filtered: a price only means something against all the hours. */
  @Get(':refCode')
  detail(@Param('refCode') refCode: string) {
    return this.analytics.projectDetail(refCode);
  }
}
