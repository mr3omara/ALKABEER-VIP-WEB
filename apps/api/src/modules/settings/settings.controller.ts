import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('System Settings')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Get all system settings' })
  async getAll() {
    return this.settingsService.getAll();
  }

  @Put(':key')
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @ApiOperation({ summary: 'Update system setting key' })
  async set(
    @Param('key') key: string,
    @Body('value') value: string,
    @Body('description') description: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.settingsService.set(key, value, description, user.id);
  }
}
