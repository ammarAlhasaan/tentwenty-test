import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AuthModule } from '../auth/auth.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { ImportsController } from './imports.controller.js';
import { ImportsService } from './imports.service.js';

@Module({
  imports: [
    // SessionAuthGuard injects AuthService, and AuthModule is not global.
    AuthModule,
    SettingsModule,
    // No storage option, so multer keeps the file in memory and hands us a
    // Buffer -- nothing is written to disk and there is nothing to clean up.
    // Nest maps multer's LIMIT_FILE_SIZE to a 413 on its own.
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: { fileSize: config.getOrThrow<number>('MAX_UPLOAD_BYTES'), files: 1 },
      }),
    }),
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
