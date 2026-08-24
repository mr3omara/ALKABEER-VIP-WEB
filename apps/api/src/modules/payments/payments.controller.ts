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
import { PaymentsService } from './payments.service';
import { CreatePaymentDto, ReversePaymentDto } from './dto/payment.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Payments Engine')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.PAYMENTS_CREATE)
  @ApiOperation({ summary: 'Record a payment with automated FIFO charge allocation' })
  async create(
    @Body() dto: CreatePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.createPayment(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'List and filter payment collections' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('customerId') customerId?: string,
  ) {
    return this.paymentsService.findMany(pagination, customerId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  @ApiOperation({ summary: 'Get full payment allocation details' })
  async findOne(@Param('id') id: string) {
    return this.paymentsService.findOne(id);
  }

  @Post(':id/reverse')
  @RequirePermissions(PERMISSIONS.PAYMENTS_REVERSE)
  @ApiOperation({ summary: 'Reverse a payment and restore allocated monthly obligations' })
  async reverse(
    @Param('id') id: string,
    @Body() dto: ReversePaymentDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.paymentsService.reversePayment(id, dto, user.id);
  }
}
