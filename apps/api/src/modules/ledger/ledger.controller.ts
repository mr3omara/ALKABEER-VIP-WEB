import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { PaginationDto } from '../../common/dto/pagination.dto';

@Controller('ledger')
@UseGuards(AuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  async getLedgerEntries(@Query() query: any) {
    const pagination = new PaginationDto();
    pagination.page = query.page ? parseInt(query.page) : 1;
    pagination.limit = query.limit ? parseInt(query.limit) : 50;

    return this.ledgerService.getLedgerEntries(
      Object.assign(pagination, {
        customerId: query.customerId,
        transactionType: query.transactionType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        direction: query.direction,
        search: query.search,
      }),
    );
  }

  @Get('statement/:customerId')
  @RequirePermissions(PERMISSIONS.PAYMENTS_VIEW)
  async getCustomerStatement(@Param('customerId') customerId: string) {
    return this.ledgerService.getCustomerStatement(customerId);
  }
}
