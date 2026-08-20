import {
  findExpiringSoonUnreminded,
  markExpiryReminderSent,
  closeExpiredJobs,
} from "../repositories/job.repository";
import { notifyJobExpiryReminder } from "../services/notification.service";
import { logger } from "../utils/logger";

const REMINDER_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

// PRD v3 §8.3 — "İlan 30 gün yayında kalır, sonra otomatik kapanır. Klinik hatırlatma alır."
// Cron kaydından ayrı export edildi ki testler zamanlamayı beklemeden doğrudan çağırabilsin.
export async function runJobExpirySweep(): Promise<void> {
  const windowEnd = new Date(Date.now() + REMINDER_WINDOW_MS);
  const expiringSoon = await findExpiringSoonUnreminded(windowEnd);
  for (const job of expiringSoon) {
    try {
      await notifyJobExpiryReminder(job.employerId.toString(), job.title);
      await markExpiryReminderSent(job._id);
    } catch (error) {
      logger.error("jobExpiry.sweep.reminder.failed", {
        jobId: job._id.toString(),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await closeExpiredJobs();
}
