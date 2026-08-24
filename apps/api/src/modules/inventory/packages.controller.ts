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
import { PERMISSIONS } from '@alkabeer/shared';

@ApiTags('Telecom Packages Hub')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.INVENTORY_VIEW)
  @ApiOperation({ summary: 'Get list of telecom packages and subscriptions' })
  async getPackages(
    @Query('search') search?: string,
    @Query('companyId') companyId?: string,
  ) {
    return this.inventoryService.getPackages(search, companyId);
  }

  @Post()
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

  @Put(':id')
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

  @Post('cleanup-duplicates')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Clean up all duplicate packages in the database' })
  async cleanupDuplicates() {
    return this.inventoryService.cleanupPackageDuplicates();
  }

  @Delete(':id')
  @RequirePermissions(PERMISSIONS.INVENTORY_ADJUST)
  @ApiOperation({ summary: 'Delete a telecom package' })
  async deletePackage(@Req() req: any, @Param('id') id: string) {
    const userId = req.user?.id;
    return this.inventoryService.deletePackage(id, userId);
  }
}
