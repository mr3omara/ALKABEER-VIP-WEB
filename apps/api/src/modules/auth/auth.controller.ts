import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse as SwaggerResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from '../../common/decorators/require-permissions.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, RequestUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate user and set secure HttpOnly cookie' })
  async login(
    @Body() loginDto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await this.authService.login(loginDto, ipAddress, userAgent);

    // Set secure HttpOnly session cookie
    const cookieName = process.env.SESSION_COOKIE_NAME || 'alkabeer_session';
    const isProd = process.env.NODE_ENV === 'production';
    const maxAge = parseInt(process.env.SESSION_EXPIRES_IN_SECONDS || '86400', 10) * 1000;

    res.cookie(cookieName, result.token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'strict' : 'lax',
      maxAge,
      path: '/',
    });

    return {
      user: result.user,
      token: result.token, // Returned for API/SDK clients; web UI uses HttpOnly cookie
    };
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session cookie' })
  async logout(
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ipAddress = req.ip || req.socket.remoteAddress;
    const userAgent = req.get('user-agent');
    const cookieName = process.env.SESSION_COOKIE_NAME || 'alkabeer_session';

    res.clearCookie(cookieName, { path: '/' });
    return this.authService.logout(user.id, ipAddress, userAgent);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user profile and permissions' })
  async me(@CurrentUser() user: RequestUser) {
    return this.authService.getProfile(user.id);
  }
}
