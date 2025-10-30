export type ActivityStreamEventType = "article:saved" | "article:deleted";

export type ActivityStreamPayload = {
  type: ActivityStreamEventType;
  slug: string;
  timestamp?: string;
  meta?: {
    title?: string;
    category?: string;
    updatedAt?: string;
    createdAt?: string;
    isDraft?: boolean;
  };
  searchGeneratedAt?: number;
};

export const ACTIVITY_EVENT_NAME = "article-update";
