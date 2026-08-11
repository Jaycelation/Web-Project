import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CsrfGuard } from '../../common/guards/csrf.guard.js';
import type { AuthenticatedUser } from '../../common/types/authenticated-user.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AccountService } from './account.service.js';
import { AddressIdDto, AddressInputDto, ChangePasswordDto, UpdateProfileDto } from './account.dto.js';

@Controller('account')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  @Post('overview')
  overview(@CurrentUser() user: AuthenticatedUser) {
    return this.account.overview(user.id);
  }

  @Post('profile/update')
  @UseGuards(CsrfGuard)
  updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    return this.account.updateProfile(user.id, dto);
  }

  @Post('addresses/save')
  @UseGuards(CsrfGuard)
  saveAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddressInputDto) {
    return this.account.saveAddress(user.id, dto);
  }

  @Post('addresses/delete')
  @UseGuards(CsrfGuard)
  deleteAddress(@CurrentUser() user: AuthenticatedUser, @Body() dto: AddressIdDto) {
    return this.account.deleteAddress(user.id, dto.addressId);
  }

  @Post('password/change')
  @UseGuards(CsrfGuard)
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.account.changePassword(user.id, dto);
  }
}
