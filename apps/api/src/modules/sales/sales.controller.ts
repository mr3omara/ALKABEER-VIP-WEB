import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SalesService } from './sales.service';
import { CreateSaleDto } from './dto/sale.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, SaleStatus } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Sales Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('sales')
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.SALES_CREATE)
  @ApiOperation({ summary: 'Execute an atomic multi-line sale transaction' })
  async create(
    @Body() dto: CreateSaleDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.createSale(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.SALES_VIEW)
  @ApiOperation({ summary: 'List sales records with pagination' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('customerId') customerId?: string,
    @Query('status') status?: SaleStatus,
  ) {
    return this.salesService.findMany(pagination, customerId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.SALES_VIEW)
  @ApiOperation({ summary: 'Get full sale transaction details' })
  async findOne(@Param('id') id: string) {
    return this.salesService.findOne(id);
  }

  @Post(':id/cancel')
  @RequirePermissions(PERMISSIONS.SALES_CANCEL)
  @ApiOperation({ summary: 'Compensate and cancel a finalized sale' })
  async cancelSale(
    @Param('id') id: string,
    @Body('reason') reason: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.salesService.cancelSale(id, reason || 'User requested cancellation', user.id);
  }
}
