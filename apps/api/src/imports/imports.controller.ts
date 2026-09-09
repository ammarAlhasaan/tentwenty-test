import { readFileSync } from 'node:fs';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { SessionAuthGuard } from '../auth/session-auth.guard.js';
import { resolveSampleDataFile } from '../config.js';
import { type SalaryUploadBody, salaryUploadSchema } from './imports.schema.js';
import { type ImportResult, ImportsService } from './imports.service.js';

/**
 * The four fields we read off a multer file. Declared here rather than pulling
 * in @types/multer, which is published for multer 1.x while the installed
 * runtime (via @nestjs/platform-express) is 2.2.0.
 */
type UploadedWorkbook = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const SAMPLE_FILES = {
  timesheet: 'timesheet-2025.xlsx',
  salaries: 'salaries-2025.xlsx',
  projects: 'project-prices-2025.xlsx',
} as const;

@Controller('imports')
@UseGuards(SessionAuthGuard)
export class ImportsController {
  constructor(private readonly imports: ImportsService) {}

  @Post('timesheet')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  timesheet(@UploadedFile() file: UploadedWorkbook | undefined, @Req() request: Request) {
    const upload = this.require(file);
    return this.imports.importTimesheet(upload.originalname, upload.buffer, request.authUser!.id);
  }

  @Post('salaries')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  salaries(
    @UploadedFile() file: UploadedWorkbook | undefined,
    @Body({ schema: salaryUploadSchema }) body: SalaryUploadBody,
    @Req() request: Request,
  ) {
    const upload = this.require(file);
    return this.imports.importSalaries(
      upload.originalname,
      upload.buffer,
      request.authUser!.id,
      body.year ?? null,
    );
  }

  @Post('projects')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  projects(@UploadedFile() file: UploadedWorkbook | undefined, @Req() request: Request) {
    const upload = this.require(file);
    return this.imports.importProjects(upload.originalname, upload.buffer, request.authUser!.id);
  }

  /**
   * Loads the workbooks tracked under apps/api/sample-data through the same
   * service methods an upload uses -- same parsing, validation, replacement and
   * audit rows. Only the source of the bytes differs. The one-click button that
   * calls this belongs to the frontend upload spec.
   */
  @Post('sample')
  @HttpCode(HttpStatus.OK)
  async sample(@Req() request: Request): Promise<{ results: ImportResult[] }> {
    const userId = request.authUser!.id;
    const read = (name: string) => readFileSync(resolveSampleDataFile(name));

    // Projects first, so the timesheet import can already see the prices and
    // report unpriced ref codes accurately.
    const results = [
      await this.imports.importProjects(SAMPLE_FILES.projects, read(SAMPLE_FILES.projects), userId),
      await this.imports.importSalaries(SAMPLE_FILES.salaries, read(SAMPLE_FILES.salaries), userId),
      await this.imports.importTimesheet(SAMPLE_FILES.timesheet, read(SAMPLE_FILES.timesheet), userId),
    ];

    return { results };
  }

  @Get()
  history() {
    return this.imports.history();
  }

  // The size limit is enforced by multer before the file is buffered; only the
  // missing-field case is left to check here.
  private require(file: UploadedWorkbook | undefined): UploadedWorkbook {
    if (!file) throw new BadRequestException('A spreadsheet is required in the "file" field.');
    return file;
  }
}
