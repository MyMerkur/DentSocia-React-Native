import { createServer } from "http";
import { env } from "./config/env";
import { connectDB } from "./config/db";
import { logger } from "./utils/logger";
import { initSockets } from "./sockets";
import { startScheduledTasks } from "./scheduledTasks";
import app from "./app";

async function bootstrap() {
  await connectDB();
  startScheduledTasks();

  const httpServer = createServer(app);
  initSockets(httpServer);

  httpServer.listen(env.PORT, () => {
    logger.info(`Server listening on port ${env.PORT}`);
  });
}

bootstrap().catch((error) => {
  logger.error("Failed to start server", error);
  process.exit(1);
});
