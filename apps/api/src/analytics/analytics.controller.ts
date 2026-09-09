import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { type PeriodQuery, periodQuerySchema } from './analytics.schema.js';
import { AnalyticsService } from './analytics.service.js';

@Controller()
@UseGuards(SessionAuthGuard)
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('periods')
  periods() {
    return this.analytics.periods();
  }

  @Get('dashboard')
  dashboard(@Query({ schema: periodQuerySchema }) query: PeriodQuery) {
    return this.analytics.dashboard(scope(query));
  }

  @Get('departments')
  departments(@Query({ schema: periodQuerySchema }) query: PeriodQuery) {
    return this.analytics.departments(scope(query));
  }

  @Get('productivity')
  productivity(@Query({ schema: periodQuerySchema }) query: PeriodQuery) {
    return this.analytics.productivity(scope(query));
  }

  @Get('categories')
  categories(@Query({ schema: periodQuerySchema }) query: PeriodQuery) {
    return this.analytics.categories(scope(query));
  }
}

export function scope(query: PeriodQuery): { year: number; month: number | null } {
  return { year: query.year, month: query.month ?? null };
}
