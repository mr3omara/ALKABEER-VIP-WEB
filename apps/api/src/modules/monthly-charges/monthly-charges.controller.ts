import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MonthlyChargesService } from './monthly-charges.service';
import { CreateMonthlyChargeDto } from './dto/monthly-charge.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, MonthlyChargeStatus } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Monthly Charges')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('monthly-charges')
export class MonthlyChargesController {
  constructor(private readonly chargesService: MonthlyChargesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.MONTHLY_CHARGES_MANAGE)
  @ApiOperation({ summary: 'Generate discrete monthly charge obligation' })
  async create(
    @Body() dto: CreateMonthlyChargeDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chargesService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.MONTHLY_CHARGES_VIEW)
  @ApiOperation({ summary: 'List and filter monthly charges and payment statuses' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('customerId') customerId?: string,
    @Query('lineId') lineId?: string,
    @Query('billingMonth') billingMonth?: string,
    @Query('status') status?: MonthlyChargeStatus,
  ) {
    return this.chargesService.findMany(pagination, customerId, lineId, billingMonth, status);
  }
}
