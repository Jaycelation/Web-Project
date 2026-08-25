import { Logger, ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { validateEnvironment } from "./config/environment.js";
import { SecureEnvelopeMiddleware } from "./infrastructure/crypto-envelope/secure-envelope.middleware.js";

async function bootstrap(): Promise<void> {
  validateEnvironment();
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const logger = new Logger("Bootstrap");
  const webOrigins = (process.env.WEB_ORIGIN ?? "http://localhost:3000")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  app.getHttpAdapter().getInstance().set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: { policy: "same-site" },
    }),
  );
  app.enableCors({
    origin: webOrigins,
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: [
      "content-type",
      "x-secure-envelope",
      "x-request-id",
      "x-csrf-token",
      "idempotency-key",
    ],
    exposedHeaders: ["x-secure-envelope", "x-request-id"],
    maxAge: 600,
  });
  app.use(cookieParser());
  app.use(
    express.json({
      limit: "1mb",
      strict: true,
      type: ["application/json", "application/jose+json"],
    }),
  );
  const secureMiddleware = app.get(SecureEnvelopeMiddleware);
  app.use((request: Request, response: Response, next: NextFunction) =>
    secureMiddleware.use(request, response, next),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      stopAtFirstError: false,
      validationError: { target: false, value: false },
    }),
  );
  app.setGlobalPrefix("api/v1");
  app.enableShutdownHooks();

  const port = Number(process.env.API_PORT ?? 4000);
  await app.listen(port, "0.0.0.0");
  logger.log(`API đang chạy tại http://localhost:${port}/api/v1`);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
