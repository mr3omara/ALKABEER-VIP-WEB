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
import { ExpensesService } from './expenses.service';
import { CreateExpenseCategoryDto, CreateExpenseDto } from './dto/expense.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Expenses')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  @Post('categories')
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Create a new expense category' })
  async createCategory(@Body() dto: CreateExpenseCategoryDto) {
    return this.expensesService.createCategory(dto);
  }

  @Get('categories')
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  @ApiOperation({ summary: 'List all expense categories' })
  async getCategories() {
    return this.expensesService.getCategories();
  }

  @Post()
  @RequirePermissions(PERMISSIONS.EXPENSES_CREATE)
  @ApiOperation({ summary: 'Record a new expense with treasury cash outflow' })
  async createExpense(
    @Body() dto: CreateExpenseDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.expensesService.createExpense(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  @ApiOperation({ summary: 'List expenses records' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.expensesService.findMany(pagination, categoryId);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.EXPENSES_VIEW)
  @ApiOperation({ summary: 'Get expense details' })
  async findOne(@Param('id') id: string) {
    return this.expensesService.findOne(id);
  }
}
