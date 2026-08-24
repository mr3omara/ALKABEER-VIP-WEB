import { Controller, Get, Post, Put, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator';
import { PERMISSIONS } from '@alkabeer/shared';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';

@ApiTags('Users Management')
@ApiBearerAuth()
@UseGuards(AuthGuard, PermissionsGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Create a new user and assign roles' })
  async create(
    @Body() dto: CreateUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.create(dto, user?.id);
  }

  @Get()
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'List users with pagination' })
  async findMany(@Query() pagination: PaginationDto) {
    return this.usersService.findMany(pagination);
  }

  @Get(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Get user by ID' })
  async findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Put(':id')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Update user profile details and roles' })
  async update(
    @Param('id') id: string,
    @Body() dto: { fullName?: string; email?: string; roles?: string[] },
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.update(id, dto, user?.id);
  }

  @Put(':id/password')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Change user password' })
  async changePassword(
    @Param('id') id: string,
    @Body('password') password: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.changePassword(id, password, user?.id);
  }

  @Patch(':id/status')
  @RequirePermissions(PERMISSIONS.USERS_MANAGE)
  @ApiOperation({ summary: 'Update user account status (ACTIVE, INACTIVE, BLOCKED)' })
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED',
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.updateStatus(id, status, user?.id);
  }
}
