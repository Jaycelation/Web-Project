import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import type { Response } from "express";
import argon2 from "argon2";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { AuthResult, AuthUserDto } from "@secure-commerce/contracts";
import type { User } from "@prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import type {
  ForgotPasswordDto,
  LoginDto,
  RegisterDto,
  ResetPasswordDto,
} from "./auth.dto.js";

interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

interface AuthBundle {
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  user: AuthUserDto;
}

type SafeUser = Pick<
  User,
  "id" | "email" | "phone" | "name" | "role" | "status"
>;

@Injectable()
export class AuthService {
  private readonly secureCookie: boolean;
  private readonly refreshDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    this.secureCookie = config.get<string>("COOKIE_SECURE", "false") === "true";
    this.refreshDays = Number(
      config.get<string>("REFRESH_TOKEN_TTL_DAYS", "30"),
    );
  }

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthBundle> {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.email },
          ...(dto.phone ? [{ phone: dto.phone }] : []),
        ],
      },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: "ACCOUNT_EXISTS",
        message: "Email hoặc số điện thoại đã được sử dụng.",
      });
    }
    const passwordHash = await this.hashPassword(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        ...(dto.phone ? { phone: dto.phone } : {}),
        name: dto.name,
        passwordHash,
      },
    });
    return this.createSession(user, meta);
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthBundle> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    const valid = user
      ? await argon2.verify(user.passwordHash, dto.password)
      : false;
    if (!user || !valid) {
      throw new UnauthorizedException({
        code: "CREDENTIALS_INVALID",
        message: "Email hoặc mật khẩu không đúng.",
      });
    }
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException({
        code: "ACCOUNT_LOCKED",
        message: "Tài khoản đang bị khóa.",
      });
    }
    return this.createSession(user, meta);
  }

  async refresh(rawRefreshToken: string | undefined): Promise<AuthBundle> {
    const parsed = parseRefreshToken(rawRefreshToken);
    if (!parsed) throw invalidRefresh();
    const currentTokenHash = hashToken(parsed.secret);
    const now = new Date();
    const session = await this.prisma.authSession.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      session.user.status !== "ACTIVE" ||
      !safeEqual(session.refreshTokenHash, currentTokenHash)
    ) {
      throw invalidRefresh();
    }

    const nextSecret = randomBytes(32).toString("base64url");
    const expiresAt = addDays(new Date(), this.refreshDays);
    const rotated = await this.prisma.authSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: currentTokenHash,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { refreshTokenHash: hashToken(nextSecret), expiresAt },
    });
    if (rotated.count !== 1) throw invalidRefresh();
    return {
      accessToken: await this.signAccessToken(session.user, session.id),
      refreshToken: `${session.id}.${nextSecret}`,
      csrfToken: randomBytes(24).toString("base64url"),
      user: toAuthUser(session.user),
    };
  }

  async logout(rawRefreshToken: string | undefined): Promise<void> {
    const parsed = parseRefreshToken(rawRefreshToken);
    if (!parsed) return;
    await this.prisma.authSession.updateMany({
      where: { id: parsed.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async requestPasswordReset(dto: ForgotPasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (!user) return;
    const rawToken = randomBytes(32).toString("base64url");
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      },
    });
    const webOrigin =
      this.config
        .get<string>("WEB_ORIGIN", "http://localhost:3000")
        .split(",")
        .map((value) => value.trim())
        .find(Boolean) ?? "http://localhost:3000";
    await this.notifications.enqueueEmail(user.email, "password-reset", {
      name: user.name,
      resetUrl: `${webOrigin}/dat-lai-mat-khau?token=${encodeURIComponent(rawToken)}`,
      expiresInMinutes: 30,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const token = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });
    if (!token || token.usedAt || token.expiresAt <= new Date()) {
      throw new UnauthorizedException({
        code: "RESET_TOKEN_INVALID",
        message: "Token đặt lại mật khẩu không hợp lệ.",
      });
    }
    const passwordHash = await this.hashPassword(dto.password);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: token.userId },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.authSession.updateMany({
        where: { userId: token.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  setAuthCookies(response: Response, bundle: AuthBundle): AuthResult {
    response.cookie("access_token", bundle.accessToken, {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: "lax",
      path: "/",
      maxAge: 15 * 60 * 1000,
    });
    response.cookie("refresh_token", bundle.refreshToken, {
      httpOnly: true,
      secure: this.secureCookie,
      sameSite: "strict",
      path: "/api/v1/auth",
      maxAge: this.refreshDays * 24 * 60 * 60 * 1000,
    });
    response.cookie("csrf_token", bundle.csrfToken, {
      httpOnly: false,
      secure: this.secureCookie,
      sameSite: "strict",
      path: "/",
      maxAge: this.refreshDays * 24 * 60 * 60 * 1000,
    });
    return { user: bundle.user, csrfToken: bundle.csrfToken };
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie("access_token", { path: "/" });
    response.clearCookie("refresh_token", { path: "/api/v1/auth" });
    response.clearCookie("csrf_token", { path: "/" });
  }

  private async createSession(
    user: SafeUser,
    meta: RequestMeta,
  ): Promise<AuthBundle> {
    const secret = randomBytes(32).toString("base64url");
    const session = await this.prisma.authSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: hashToken(secret),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
        ...(meta.ipAddress ? { ipAddress: meta.ipAddress } : {}),
        expiresAt: addDays(new Date(), this.refreshDays),
      },
    });
    return {
      accessToken: await this.signAccessToken(user, session.id),
      refreshToken: `${session.id}.${secret}`,
      csrfToken: randomBytes(24).toString("base64url"),
      user: toAuthUser(user),
    };
  }

  private signAccessToken(user: SafeUser, sessionId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.id, sid: sessionId, email: user.email, role: user.role },
      {
        expiresIn: this.config.get<string>("ACCESS_TOKEN_TTL", "15m") as never,
      },
    );
  }

  private hashPassword(password: string): Promise<string> {
    return argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19_456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}

function hashToken(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function parseRefreshToken(
  value: string | undefined,
): { sessionId: string; secret: string } | null {
  if (!value) return null;
  const dot = value.indexOf(".");
  if (dot <= 0 || dot === value.length - 1) return null;
  return { sessionId: value.slice(0, dot), secret: value.slice(dot + 1) };
}

function invalidRefresh(): UnauthorizedException {
  return new UnauthorizedException({
    code: "REFRESH_TOKEN_INVALID",
    message: "Refresh token không hợp lệ.",
  });
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function toAuthUser(user: SafeUser): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    name: user.name,
    role: user.role,
  };
}
