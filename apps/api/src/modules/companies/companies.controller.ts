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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, PaymentMethod } from '@alkabeer/shared';

@ApiTags('Telecom Companies & B2B Liabilities')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Add a new telecom company' })
  async create(@Body() dto: CreateCompanyDto) {
    return this.companiesService.create(dto);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.COMPANIES_VIEW)
  @ApiOperation({ summary: 'List all telecom companies' })
  async findAll() {
    return this.companiesService.findAll();
  }

  @Get('liabilities')
  @RequirePermissions(PERMISSIONS.COMPANIES_VIEW)
  @ApiOperation({ summary: 'List and filter B2B company liabilities and invoices' })
  async getLiabilities(
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.companiesService.getLiabilities(status, search);
  }

  @Post('liabilities')
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Create a new B2B company invoice / liability' })
  async createLiability(
    @Req() req: any,
    @Body()
    body: {
      companyId: string;
      billingMonth: string;
      dueDate: string;
      amount: number;
      notes?: string;
    },
  ) {
    const userId = req.user?.id;
    return this.companiesService.createLiability(body, userId);
  }

  @Post('liabilities/:id/pay')
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Pay an installment towards a B2B company invoice from Treasury' })
  async payLiabilityInstallment(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      amount: number;
      treasuryAccountId: string;
      paymentMethod?: PaymentMethod;
      notes?: string;
    },
  ) {
    const userId = req.user?.id;
    return this.companiesService.payLiabilityInstallment(id, body, userId);
  }

  @Delete('liabilities/:id')
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Delete a B2B company liability' })
  async deleteLiability(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    return this.companiesService.deleteLiability(id, userId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_VIEW)
  @ApiOperation({ summary: 'Get company by ID' })
  async findOne(@Param('id') id: string) {
    return this.companiesService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Update a telecom company' })
  async update(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.companiesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.COMPANIES_MANAGE)
  @ApiOperation({ summary: 'Delete a telecom company' })
  async remove(@Param('id') id: string) {
    return this.companiesService.remove(id);
  }
}
