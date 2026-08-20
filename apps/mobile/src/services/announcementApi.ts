import { apiClient } from "./authApi";

export type AnnouncementType = "system" | "editorial";

export interface AnnouncementItem {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string;
  createdAt: string;
}

export interface AnnouncementFeedPage {
  announcements: AnnouncementItem[];
  nextCursor: string | null;
}

export async function getAnnouncements(cursor?: string): Promise<AnnouncementFeedPage> {
  const { data } = await apiClient.get<AnnouncementFeedPage>("/api/v1/announcements", {
    params: cursor ? { cursor } : undefined,
  });
  return data;
}
