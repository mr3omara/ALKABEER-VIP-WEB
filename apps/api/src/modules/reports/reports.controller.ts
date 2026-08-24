import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';

@ApiTags('Reports & Analytics')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('customer-debts')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Get customer debt ledger breakdown by unpaid month' })
  async getCustomerDebts(@Query('customerId') customerId?: string) {
    return this.reportsService.getCustomerDebtReport(customerId);
  }

  @Get('dashboard-summary')
  @RequirePermissions(PERMISSIONS.REPORTS_VIEW)
  @ApiOperation({ summary: 'Get overall aggregated executive dashboard summary' })
  async getDashboardSummary() {
    return this.reportsService.getDashboardSummary();
  }
}
