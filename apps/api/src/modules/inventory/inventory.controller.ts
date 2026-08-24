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
import { InventoryService } from './inventory.service';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS, InventoryMovementType } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Inventory & Telecom Packages')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get('movements')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({ summary: 'List immutable inventory ledger movements' })
  async getMovements(
    @Query() pagination: PaginationDto,
    @Query('lineId') lineId?: string,
    @Query('movementType') movementType?: InventoryMovementType,
  ) {
    return this.inventoryService.getMovements(pagination, lineId, movementType);
  }

  @Post('adjust')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Record manual inventory movement adjustment' })
  async adjustStock(
    @Body('lineId') lineId: string,
    @Body('movementType') movementType: InventoryMovementType,
    @Body('notes') notes: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.inventoryService.adjustStock(lineId, movementType, notes, user.id);
  }

  // ----------------------------------------------------
  // TELECOM PACKAGES ENDPOINTS
  // ----------------------------------------------------

  @Get('packages')
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get list of telecom packages and subscriptions' })
  async getPackages(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.inventoryService.getPackages(search, companyId);
  }

  @Post('packages')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Create a new telecom package' })
  async createPackage(
    @Req() req: any,
    @Body()
    body: {
      name: string;
      companyId: string;
      faceValue: number;
      costPrice: number;
      sellingPrice: number;
      details?: string;
    },
  ) {
    const userId = req.user?.id;
    return this.inventoryService.createPackage(body, userId);
  }

  @Put('packages/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Update an existing telecom package' })
  async updatePackage(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      name?: string;
      faceValue?: number;
      costPrice?: number;
      sellingPrice?: number;
      details?: string;
      status?: 'ACTIVE' | 'INACTIVE';
    },
  ) {
    const userId = req.user?.id;
    return this.inventoryService.updatePackage(id, body, userId);
  }

  @Post('packages/cleanup-duplicates')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Clean up all duplicate packages in the database' })
  async cleanupPackageDuplicates() {
    return this.inventoryService.cleanupPackageDuplicates();
  }

  @Delete('packages/:id')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Delete a telecom package' })
  async deletePackage(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    return this.inventoryService.deletePackage(id, userId);
  }
}
