import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DailyClosingService } from './daily-closing.service';
import {
  CloseDailyClosingDto,
  OpenDailyClosingDto,
  ReopenDailyClosingDto,
} from './dto/daily-closing.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Daily Closing & Reconciliation')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('daily-closing')
export class DailyClosingController {
  constructor(private readonly closingService: DailyClosingService) {}

  @Post('open')
  @RequirePermissions(PERMISSIONS.DAILY_CLOSING_MANAGE)
  @ApiOperation({ summary: 'Open a daily business shift with opening physical balance' })
  async openDay(
    @Body() dto: OpenDailyClosingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closingService.openDay(dto, user.id);
  }

  @Post(':date/close')
  @RequirePermissions(PERMISSIONS.DAILY_CLOSING_MANAGE)
  @ApiOperation({ summary: 'Close day, reconcile totals, and compute difference' })
  async closeDay(
    @Param('date') date: string,
    @Body() dto: CloseDailyClosingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closingService.closeDay(date, dto, user.id);
  }

  @Post(':date/reopen')
  @RequirePermissions(PERMISSIONS.DAILY_CLOSING_REOPEN)
  @ApiOperation({ summary: 'Reopen a closed day with permission and audit trail' })
  async reopenDay(
    @Param('date') date: string,
    @Body() dto: ReopenDailyClosingDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.closingService.reopenDay(date, dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.DAILY_CLOSING_VIEW)
  @ApiOperation({ summary: 'List recent daily closings' })
  async listClosings() {
    return this.closingService.listClosings();
  }

  @Get(':date')
  @RequirePermissions(PERMISSIONS.DAILY_CLOSING_VIEW)
  @ApiOperation({ summary: 'Get daily closing report for date' })
  async getByDate(@Param('date') date: string) {
    return this.closingService.getClosingByDate(date);
  }
}
