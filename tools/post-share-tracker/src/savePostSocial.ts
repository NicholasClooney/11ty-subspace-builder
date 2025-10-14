import fs from "node:fs/promises";
import matter from "gray-matter";
import {
  SOCIAL_CHANNELS,
  SOCIAL_STATES,
  SocialChannel,
  SocialState,
} from "./config.js";
import type { SocialStatus } from "./loadPosts.js";

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

export interface SavePostSocialArgs {
  filepath: string;
  channel: SocialChannel;
  status: SocialState;
  lastShared?: string;
  notes?: string;
  options?: SavePostSocialOptions;
}

export interface SavePostSocialOptions {
  dryRun?: boolean;
  autoTimestamp?: boolean;
  timestampFactory?: () => string;
}

export interface SavePostSocialResult {
  changed: boolean;
  status: SocialStatus;
  content: string;
}

const sanitizeOptionalString = (value?: string): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

export const savePostSocial = async ({
  filepath,
  channel,
  status,
  lastShared,
  notes,
  options,
}: SavePostSocialArgs): Promise<SavePostSocialResult> => {
  if (!SOCIAL_CHANNELS.includes(channel)) {
    throw new Error(`Unknown social channel: ${channel}`);
  }

  if (!SOCIAL_STATES.includes(status)) {
    throw new Error(`Unsupported social status: ${status}`);
  }

  const resolvedNotes = sanitizeOptionalString(notes);
  let resolvedLastShared = sanitizeOptionalString(lastShared);

  const autoTimestamp = options?.autoTimestamp ?? false;
  if (!resolvedLastShared && autoTimestamp && status === "shared") {
    const factory = options?.timestampFactory ?? (() => new Date().toISOString());
    resolvedLastShared = factory();
  }

  const fileContents = await fs.readFile(filepath, "utf8");
  const parsed = matter(fileContents);

  const data = isRecord(parsed.data) ? { ...parsed.data } : {};
  const social = isRecord(data.social) ? { ...data.social } : {};

  const nextStatus: SocialStatus = {
    status,
    ...(resolvedLastShared ? { lastShared: resolvedLastShared } : {}),
    ...(resolvedNotes ? { notes: resolvedNotes } : {}),
  };

  social[channel] = nextStatus;
  data.social = social;

  const nextContent = matter.stringify(parsed.content, data);
  const changed = nextContent !== fileContents;

  if (!options?.dryRun && changed) {
    await fs.writeFile(filepath, nextContent, "utf8");
  }

  return {
    changed,
    status: nextStatus,
    content: nextContent,
  };
};
