import cron from "node-cron";
import { runJobExpirySweep } from "./jobExpiry.task";
import { runPostHireVerificationSweep } from "../services/postHireVerification.service";
import { logger } from "../utils/logger";

// In-process node-cron, not BullMQ+Redis — beta ölçeğinde (~60 ilan) günde birkaç kez
// tetiklenen bir görev için kuyruk altyapısı gerektirmiyor, .env'deki REDIS_URL zaten
// kullanılmayan bir kalıntı. server.ts'in bootstrap'ından çağrılır; test dosyaları app.ts'i
// import ettiği için (server.ts'i değil) bu hiç tetiklenmez — testler run*Sweep()
// fonksiyonlarını doğrudan çağırır.
export function startScheduledTasks(): void {
  cron.schedule("0 3 * * *", async () => {
    try {
      await runJobExpirySweep();
    } catch (error) {
      logger.error("scheduledTasks.jobExpiry.failed", { error: error instanceof Error ? error.message : String(error) });
    }
  });

  cron.schedule("0 3 * * *", async () => {
    try {
      await runPostHireVerificationSweep();
    } catch (error) {
      logger.error("scheduledTasks.postHireVerification.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  logger.info("scheduledTasks.started");
}
