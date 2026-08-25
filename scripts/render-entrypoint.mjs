import http from "node:http";
import { spawn } from "node:child_process";

const externalPort = parsePort(process.env.PORT ?? "10000", "PORT");
const apiPort = parsePort(process.env.API_PORT ?? "4000", "API_PORT");
const webPort = 3000;
const externalUrl =
  process.env.WEB_ORIGIN ||
  process.env.RENDER_EXTERNAL_URL ||
  `http://localhost:${externalPort}`;

const commonEnvironment = {
  ...process.env,
  WEB_ORIGIN: externalUrl,
};

await runRequired(
  "database migration",
  "node",
  [
    "/app/apps/api/node_modules/prisma/build/index.js",
    "migrate",
    "deploy",
    "--schema",
    "/app/apps/api/prisma/schema.prisma",
  ],
  commonEnvironment,
);

if (process.env.DEPLOY_SEED_CATALOG === "true") {
  await runRequired(
    "catalog seed",
    "/app/node_modules/.bin/tsx",
    ["/app/apps/api/prisma/seed.ts"],
    {
      ...commonEnvironment,
      ALLOW_DEMO_SEED: "true",
      SEED_DEMO_ACCOUNTS: "false",
    },
  );
}

const children = [];
let gateway;
children.push(
  startChild("api", "node", ["/app/apps/api/dist/main.js"], {
    ...commonEnvironment,
    API_PORT: String(apiPort),
  }),
  startChild("web", "node", ["/app/web/apps/web/server.js"], {
    ...commonEnvironment,
    PORT: String(webPort),
    HOSTNAME: "127.0.0.1",
    API_INTERNAL_URL: `http://127.0.0.1:${apiPort}/api/v1`,
  }),
);

gateway = http.createServer((request, response) => {
  const requestPath = request.url ?? "/";
  const targetPort =
    requestPath === "/api/v1" || requestPath.startsWith("/api/v1/")
      ? apiPort
      : webPort;
  const headers = { ...request.headers };
  if (!headers["x-forwarded-proto"] && process.env.RENDER === "true") {
    headers["x-forwarded-proto"] = "https";
  }

  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: targetPort,
      path: requestPath,
      method: request.method,
      headers,
    },
    (upstreamResponse) => {
      response.writeHead(
        upstreamResponse.statusCode ?? 502,
        upstreamResponse.rawHeaders,
      );
      upstreamResponse.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent) {
      response.writeHead(503, { "content-type": "text/plain; charset=utf-8" });
    }
    response.end("Service is starting. Please retry shortly.");
  });
  request.pipe(upstream);
});

gateway.on("clientError", (_error, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
});

gateway.listen(externalPort, "0.0.0.0", () => {
  console.log(`MIRA gateway ready on port ${externalPort}.`);
});

let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => shutdown(signal));
}

function startChild(name, command, args, env) {
  const child = spawn(command, args, {
    cwd: "/app",
    env,
    stdio: "inherit",
  });
  child.on("exit", (code, signal) => {
    if (stopping) return;
    console.error(
      `${name} stopped unexpectedly (code=${code}, signal=${signal}).`,
    );
    shutdown("SIGTERM", 1);
  });
  return child;
}

function runRequired(name, command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: "/app",
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else
        reject(new Error(`${name} failed (code=${code}, signal=${signal}).`));
    });
  });
}

function shutdown(signal, exitCode = 0) {
  if (stopping) return;
  stopping = true;
  gateway?.close();
  for (const child of children) {
    if (!child.killed) child.kill(signal);
  }
  setTimeout(() => process.exit(exitCode), 5_000).unref();
}

function parsePort(value, name) {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${name} không hợp lệ.`);
  }
  return port;
}
