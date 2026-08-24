import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto } from './dto/customer.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, CustomerStatus } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_CREATE)
  @ApiOperation({ summary: 'Register a new customer' })
  async create(
    @Body() dto: CreateCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.create(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'List and search customers' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('status') status?: CustomerStatus,
  ) {
    return this.customersService.findMany(pagination, status);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_VIEW)
  @ApiOperation({ summary: 'Get customer profile with lines and billing history' })
  async findOne(@Param('id') id: string) {
    return this.customersService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_EDIT)
  @ApiOperation({ summary: 'Update customer details' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.CUSTOMERS_DELETE)
  @ApiOperation({ summary: 'Soft delete a customer without financial history' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.customersService.softDelete(id, user.id);
  }
}
