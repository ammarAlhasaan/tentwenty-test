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
  async update(@Body({ schema: updateSettingsSchema }) body: UpdateSettingsBody) {
    await this.settings.update(body);
    return this.present();
  }

  private async present() {
    const { billableCategories, monthlyOverhead } = await this.settings.read();
    return {
      billableCategories,
      monthlyOverhead,
      currency: 'AED',
      knownCategories: await this.settings.knownCategories(),
    };
  }
}
