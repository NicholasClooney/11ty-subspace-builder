import { globby } from "globby";
import matter from "gray-matter";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SOCIAL_CHANNELS, SOCIAL_STATES, SocialChannel, SocialState } from "./config.js";

export interface SocialStatus {
  status: SocialState;
  lastShared?: string;
  notes?: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  filepath: string;
  social?: Partial<Record<SocialChannel, SocialStatus>>;
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const postsDir = path.join(repoRoot, "posts");

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null && !Array.isArray(value);
};

const parseSocialStatus = (value: unknown): SocialStatus | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const status = value.status;
  if (typeof status !== "string" || !SOCIAL_STATES.includes(status as SocialState)) {
    return undefined;
  }

  const parsed: SocialStatus = { status };

  if (typeof value.lastShared === "string") {
    parsed.lastShared = value.lastShared;
  }

  if (typeof value.notes === "string") {
    parsed.notes = value.notes;
  }

  return parsed;
};

export const loadPosts = async (): Promise<PostMeta[]> => {
  const files = await globby("**/*.md", { cwd: postsDir, absolute: true });

  const posts = await Promise.all(
    files.map(async (filepath) => {
      const fileContents = await fs.readFile(filepath, "utf8");
      const { data } = matter(fileContents);

      const relativePath = path.relative(postsDir, filepath);
      const slug = relativePath.replace(/\\/g, "/").replace(/\.md$/, "");
      const title = typeof data.title === "string" && data.title.trim() !== "" ? data.title.trim() : slug;

      let social: PostMeta["social"];
      if (isRecord(data.social)) {
        const entries = SOCIAL_CHANNELS.map((channel) => {
          const parsed = parseSocialStatus(data.social?.[channel]);
          return parsed ? [channel, parsed] : undefined;
        }).filter((entry): entry is [SocialChannel, SocialStatus] => Boolean(entry));

        if (entries.length > 0) {
          social = Object.fromEntries(entries) as PostMeta["social"];
        }
      }

      return {
        slug,
        title,
        filepath,
        social,
      } satisfies PostMeta;
    })
  );

  return posts.sort((a, b) => a.title.localeCompare(b.title));
};
