import { apiClient } from "./authApi";
import type { ReportTargetType, ReportReason } from "./adminApi";

export async function createReport(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason,
  details?: string,
): Promise<void> {
  await apiClient.post("/api/v1/reports", { targetType, targetId, reason, details });
}
