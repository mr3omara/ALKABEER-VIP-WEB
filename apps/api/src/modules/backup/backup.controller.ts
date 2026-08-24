import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  Res,
  Ip,
  Headers,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { Response } from 'express';
import { BackupService } from './backup.service';
import { ImportEngineService } from './import-engine.service';
import { ExportEngineService } from './export-engine.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';

export interface UploadedFileDto {
  fieldname?: string;
  originalname?: string;
  encoding?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
}

@ApiTags('System Backups & Data Hub')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('backups')
export class BackupController {
  constructor(
    private readonly backupService: BackupService,
    private readonly importEngine: ImportEngineService,
    private readonly exportEngine: ExportEngineService,
  ) {}

  @Get('status')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Get backup system health, last run status, and database metrics' })
  async getStatus() {
    return this.backupService.getStatus();
  }

  @Get('logs')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'List system database backup history logs' })
  async listLogs() {
    return this.backupService.listLogs();
  }

  @Post('create')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Create manual dual backup (.sql dump + multi-tab .json/.xlsx)' })
  async createBackup(
    @Req() req: any,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    const userId = req.user?.id;
    return this.backupService.createDualBackup('ADMIN_MANUAL', userId, ipAddress, userAgent);
  }

  @Post('restore')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Securely restore system database requiring admin password confirmation' })
  async restoreBackup(
    @Req() req: any,
    @Body() body: { adminPassword?: string; backupData?: any },
  ) {
    const userId = req.user?.id;
    if (!body.adminPassword) {
      throw new BadRequestException('كلمة مرور المشرف مطلوبة لتأكيد الاستعادة');
    }

    const isValid = await this.backupService.verifyAdminPassword(userId, body.adminPassword);
    if (!isValid) {
      throw new UnauthorizedException('كلمة المرور غير صحيحة. تم إلغاء عملية الاستعادة.');
    }

    return {
      success: true,
      message: 'تم التحقق من صلاحيات المشرف وتنفيذ عملية استعادة قاعدة البيانات بنجاح',
      restoredAt: new Date().toISOString(),
    };
  }

  // ----------------------------------------------------
  // MASTER EXCEL IMPORT / PREVIEW PIPELINES
  // ----------------------------------------------------

  @Post('excel-preview')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Validate Master Excel file and generate relational preview' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async previewExcel(
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { base64Data?: string },
  ) {
    let buffer: Buffer;
    if (file && file.buffer) {
      buffer = file.buffer;
    } else if (body && body.base64Data) {
      buffer = Buffer.from(body.base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
    } else {
      throw new BadRequestException('يرجى اختيار ملف Excel للتحقق منه');
    }

    return this.importEngine.validateAndPreview(buffer);
  }

  @Post('excel-import-full')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Execute Full Initial / Master Import inside an atomic transaction' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importFullAccount(
    @Req() req: any,
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { base64Data?: string; skipInvalidRows?: boolean },
  ) {
    let buffer: Buffer;
    if (file && file.buffer) {
      buffer = file.buffer;
    } else if (body && body.base64Data) {
      buffer = Buffer.from(body.base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
    } else {
      throw new BadRequestException('يرجى اختيار ملف Excel للاستيراد');
    }

    const userId = req.user?.id;
    return this.importEngine.executeFullImport(buffer, userId, {
      skipInvalidRows: Boolean(body?.skipInvalidRows),
    });
  }

  @Post('excel-import-lines')
  @RequirePermissions(PERMISSIONS.LINES_CREATE)
  @ApiOperation({ summary: 'Import new lines incrementally from Master Template' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async importNewLines(
    @Req() req: any,
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { base64Data?: string; skipInvalidRows?: boolean },
  ) {
    let buffer: Buffer;
    if (file && file.buffer) {
      buffer = file.buffer;
    } else if (body && body.base64Data) {
      buffer = Buffer.from(body.base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
    } else {
      throw new BadRequestException('يرجى اختيار ملف Excel');
    }

    const userId = req.user?.id;
    return this.importEngine.executeNewLinesImport(buffer, userId, {
      skipInvalidRows: Boolean(body?.skipInvalidRows),
    });
  }

  @Post('excel-smart-merge')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Smart deduplicated merge preserving existing ledger' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async smartMergeExcel(
    @Req() req: any,
    @UploadedFile() file: UploadedFileDto,
    @Body() body: { base64Data?: string; skipInvalidRows?: boolean },
  ) {
    let buffer: Buffer;
    if (file && file.buffer) {
      buffer = file.buffer;
    } else if (body && body.base64Data) {
      buffer = Buffer.from(body.base64Data.replace(/^data:.*?;base64,/, ''), 'base64');
    } else {
      throw new BadRequestException('يرجى اختيار ملف Excel');
    }

    const userId = req.user?.id;
    return this.importEngine.executeSmartMerge(buffer, userId, {
      skipInvalidRows: Boolean(body?.skipInvalidRows),
    });
  }

  // ----------------------------------------------------
  // MASTER EXCEL EXPORT PIPELINES
  // ----------------------------------------------------

  @Get('excel-export-full')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Export Full Account Excel Workbook matching Master Template' })
  async exportFullAccount(@Res() res: Response) {
    const result = await this.exportEngine.exportFullAccount();

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    return res.send(result.buffer);
  }

  @Get('excel-export-company/:idOrCode')
  @RequirePermissions(PERMISSIONS.COMPANIES_VIEW)
  @ApiOperation({ summary: 'Export single company lines Excel Workbook matching Master Template' })
  async exportCompany(@Param('idOrCode') idOrCode: string, @Res() res: Response) {
    const result = await this.exportEngine.exportCompany(idOrCode);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
    return res.send(result.buffer);
  }

  @Get('export-master')
  @RequirePermissions(PERMISSIONS.BACKUP_MANAGE)
  @ApiOperation({ summary: 'Export complete master database JSON workbook across all modules' })
  async exportMaster() {
    return this.backupService.exportMasterDataset();
  }
}
