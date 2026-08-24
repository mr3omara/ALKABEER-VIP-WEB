import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { TreasuryService } from './treasury.service';
import { CreateTreasuryAccountDto, TransferFundsDto } from './dto/treasury.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import {
  PERMISSIONS,
  TreasuryDirection,
  TreasuryTransactionType,
} from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Treasury & Cash Accounts')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('treasury')
export class TreasuryController {
  constructor(private readonly treasuryService: TreasuryService) {}

  @Post('accounts')
  @RequirePermissions(PERMISSIONS.TREASURY_MANAGE)
  @ApiOperation({ summary: 'Create a new treasury / bank / wallet account' })
  async createAccount(
    @Body() dto: CreateTreasuryAccountDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.treasuryService.createAccount(dto, user.id);
  }

  @Get('accounts')
  @RequirePermissions(PERMISSIONS.TREASURY_VIEW)
  @ApiOperation({ summary: 'List all treasury accounts and live balances' })
  async getAccounts() {
    return this.treasuryService.getAccounts();
  }

  @Post('transfer')
  @RequirePermissions(PERMISSIONS.TREASURY_CREATE)
  @ApiOperation({ summary: 'Transfer funds between treasury accounts' })
  async transferFunds(
    @Body() dto: TransferFundsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.treasuryService.transferFunds(dto, user.id);
  }

  @Get('transactions')
  @RequirePermissions(PERMISSIONS.TREASURY_VIEW)
  @ApiOperation({ summary: 'List cash flow treasury transactions ledger' })
  async getTransactions(
    @Query() pagination: PaginationDto,
    @Query('accountId') accountId?: string,
    @Query('transactionType') transactionType?: TreasuryTransactionType,
    @Query('direction') direction?: TreasuryDirection,
  ) {
    return this.treasuryService.getTransactions(
      pagination,
      accountId,
      transactionType,
      direction,
    );
  }
}
