import { ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import type { AddressInputDto, ChangePasswordDto, UpdateProfileDto } from './account.dto.js';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
        addresses: { orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] },
        _count: { select: { orders: true } },
      },
    });
    if (!user) throw new NotFoundException({ code: 'ACCOUNT_NOT_FOUND', message: 'Không tìm thấy tài khoản.' });
    return { ...user, createdAt: user.createdAt.toISOString() };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: { name: dto.name, ...(dto.phone !== undefined ? { phone: dto.phone || null } : {}) },
        select: { id: true, name: true, email: true, phone: true, role: true },
      });
    } catch (error) {
      if (isUnique(error)) {
        throw new ConflictException({ code: 'PHONE_EXISTS', message: 'Số điện thoại đã được sử dụng.' });
      }
      throw error;
    }
  }

  async saveAddress(userId: string, dto: AddressInputDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) await tx.address.updateMany({ where: { userId }, data: { isDefault: false } });
      const data = {
        label: dto.label,
        fullName: dto.fullName,
        phone: dto.phone,
        line1: dto.line1,
        ...(dto.line2 !== undefined ? { line2: dto.line2 || null } : {}),
        ...(dto.ward !== undefined ? { ward: dto.ward || null } : {}),
        district: dto.district,
        province: dto.province,
        ...(dto.postalCode !== undefined ? { postalCode: dto.postalCode || null } : {}),
        country: dto.country || 'VN',
        isDefault: dto.isDefault,
      };
      if (dto.id) {
        const existing = await tx.address.findFirst({ where: { id: dto.id, userId }, select: { id: true } });
        if (!existing) throw addressNotFound();
        return tx.address.update({ where: { id: dto.id }, data });
      }
      const count = await tx.address.count({ where: { userId } });
      return tx.address.create({ data: { userId, ...data, isDefault: dto.isDefault || count === 0 } });
    });
  }

  async deleteAddress(userId: string, addressId: string) {
    const result = await this.prisma.address.deleteMany({ where: { id: addressId, userId } });
    if (!result.count) throw addressNotFound();
    return { ok: true };
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<{ ok: true }> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.currentPassword))) {
      throw new UnauthorizedException({ code: 'CURRENT_PASSWORD_INVALID', message: 'Mật khẩu hiện tại không đúng.' });
    }
    const passwordHash = await argon2.hash(dto.newPassword, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
      this.prisma.authSession.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { ok: true };
  }
}

function addressNotFound(): NotFoundException {
  return new NotFoundException({ code: 'ADDRESS_NOT_FOUND', message: 'Không tìm thấy địa chỉ.' });
}

function isUnique(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 'P2002');
}
