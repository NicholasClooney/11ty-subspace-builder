import { globby } from "globby";
import matter from "gray-matter";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SOCIAL_PLATFORMS = ["twitter", "linkedin", "mastodon"] as const;

export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];
export type SocialState = "queued" | "shared" | "draft";

export interface SocialStatus {
  status: SocialState;
  lastShared?: string;
  notes?: string;
}

export interface PostMeta {
  slug: string;
  title: string;
  filepath: string;
  social?: Partial<Record<SocialPlatform, SocialStatus>>;
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
  if (status !== "queued" && status !== "shared" && status !== "draft") {
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
        const entries = SOCIAL_PLATFORMS.map((platform) => {
          const parsed = parseSocialStatus(data.social?.[platform]);
          return parsed ? [platform, parsed] : undefined;
        }).filter((entry): entry is [SocialPlatform, SocialStatus] => Boolean(entry));

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
