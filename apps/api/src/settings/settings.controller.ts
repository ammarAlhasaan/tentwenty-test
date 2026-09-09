import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { type UpdateSettingsBody, updateSettingsSchema } from './settings.schema.js';
import { SettingsService } from './settings.service.js';

@Controller('settings')
@UseGuards(SessionAuthGuard)
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  read() {
    return this.present();
  }

  @Put()
  update(@Body({ schema: updateSettingsSchema }) body: UpdateSettingsBody) {
    this.settings.update(body);
    return this.present();
  }

  private present() {
    const { billableCategories, monthlyOverhead } = this.settings.read();
    return {
      billableCategories,
      monthlyOverhead,
      currency: 'AED',
      knownCategories: this.settings.knownCategories(),
    };
  }
}
