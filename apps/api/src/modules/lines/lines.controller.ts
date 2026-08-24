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
import { LinesService } from './lines.service';
import { CreateLineDto, CreateBulkLinesDto, UpdateLineDto } from './dto/line.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, LineStatus } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Phone Lines')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('lines')
export class LinesController {
  constructor(private readonly linesService: LinesService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.LINES_CREATE)
  @ApiOperation({ summary: 'Register a new line into inventory stock' })
  async create(
    @Body() dto: CreateLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.linesService.create(dto, user.id);
  }

  @Post('bulk')
  @RequirePermissions(PERMISSIONS.LINES_CREATE)
  @ApiOperation({ summary: 'Register multiple lines in bulk into inventory stock' })
  async createBulk(
    @Body() dto: CreateBulkLinesDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.linesService.createBulk(dto, user.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.LINES_VIEW)
  @ApiOperation({ summary: 'List and filter lines' })
  async findMany(
    @Query() pagination: PaginationDto,
    @Query('companyId') companyId?: string,
    @Query('status') status?: LineStatus,
    @Query('customerId') customerId?: string,
    @Query('monthlyPackage') monthlyPackage?: number,
  ) {
    return this.linesService.findMany(pagination, companyId, status, customerId, monthlyPackage);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.LINES_VIEW)
  @ApiOperation({ summary: 'Get line full details including history' })
  async findOne(@Param('id') id: string) {
    return this.linesService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.LINES_EDIT)
  @ApiOperation({ summary: 'Update line properties or status' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateLineDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.linesService.update(id, dto, user.id);
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.LINES_DELETE)
  @ApiOperation({ summary: 'Delete line from inventory' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.linesService.remove(id, user.id);
  }
}
