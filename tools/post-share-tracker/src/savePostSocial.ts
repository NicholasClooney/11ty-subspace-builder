import fs from "node:fs/promises";
import matter from "gray-matter";
import {
  SOCIAL_CHANNELS,
  SOCIAL_STATES,
  SocialChannel,
  SocialState,
} from "./config.js";
import type { SocialStatus } from "./loadPosts.js";
import YAML from "yaml";

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

  const nextStatus: SocialStatus = {
    status,
    ...(resolvedLastShared ? { lastShared: resolvedLastShared } : {}),
    ...(resolvedNotes ? { notes: resolvedNotes } : {}),
  };

  const existingData = isRecord(parsed.data) ? parsed.data : {};
  const existingSocial = isRecord(existingData.social) ? existingData.social : {};

  const clonedSocial: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(existingSocial)) {
    clonedSocial[key] = isRecord(value) ? { ...value } : value;
  }

  const channelEntry = isRecord(clonedSocial[channel])
    ? { ...clonedSocial[channel] }
    : {};

  channelEntry.status = status;

  if (resolvedLastShared) {
    channelEntry.lastShared = resolvedLastShared;
  } else {
    delete channelEntry.lastShared;
  }

  if (resolvedNotes) {
    channelEntry.notes = resolvedNotes;
  } else {
    delete channelEntry.notes;
  }

  clonedSocial[channel] = channelEntry;

  const orderedSocial: Record<string, unknown> = {};
  const seen = new Set<string>();

  for (const knownChannel of SOCIAL_CHANNELS) {
    if (knownChannel in clonedSocial) {
      orderedSocial[knownChannel] = clonedSocial[knownChannel];
      seen.add(knownChannel);
    }
  }

  for (const [key, value] of Object.entries(clonedSocial)) {
    if (!seen.has(key)) {
      orderedSocial[key] = value;
    }
  }

  const socialYaml = YAML.stringify({ social: orderedSocial }, { indent: 2, lineWidth: 0 }).trimEnd();
  const socialLines = socialYaml.split("\n");

  const newline = fileContents.includes("\r\n") ? "\r\n" : "\n";
  const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:(\r?\n)|$)/;
  const match = frontMatterRegex.exec(fileContents);

  let nextContent: string;

  if (match) {
    const matterBody = match[1];
    const lines = matterBody.split(/\r?\n/);

    let socialStart = -1;
    let socialEnd = lines.length;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (socialStart === -1) {
        if (line.trimStart().startsWith("social:")) {
          socialStart = index;
        }
        continue;
      }

      if (line.trim() === "") {
        continue;
      }

      if (!line.startsWith(" ") && !line.startsWith("\t")) {
        socialEnd = index;
        break;
      }
    }

    const trailingBlankLines: string[] = [];
    if (socialStart !== -1) {
      for (let index = socialEnd - 1; index > socialStart; index -= 1) {
        if (lines[index]?.trim() === "") {
          trailingBlankLines.push("");
        } else {
          break;
        }
      }
      trailingBlankLines.reverse();
    }

    const replacement = socialStart === -1
      ? (() => {
          const hasOnlyEmptyLine = lines.length === 1 && lines[0] === "";
          const updatedLines = hasOnlyEmptyLine ? [] : [...lines];
          const insert: string[] = [];
          if (updatedLines.length > 0 && updatedLines[updatedLines.length - 1]?.trim() !== "") {
            insert.push("");
          }
          insert.push(...socialLines);
          return [...updatedLines, ...insert];
        })()
      : (() => {
          const updatedLines = [...lines];
          updatedLines.splice(socialStart, socialEnd - socialStart, ...socialLines, ...trailingBlankLines);
          return updatedLines;
        })();

    const updatedBody = replacement.join(newline);
    const closingSuffix = match[0].slice(match[0].lastIndexOf("---") + 3);
    const frontMatterStart = match.index ?? 0;
    const frontMatterEnd = frontMatterStart + match[0].length;
    const before = fileContents.slice(0, frontMatterStart);
    const after = fileContents.slice(frontMatterEnd);
    const updatedFrontMatter = `---${newline}${updatedBody}${newline}---${closingSuffix}`;
    nextContent = `${before}${updatedFrontMatter}${after}`;
  } else {
    const prefix = `---${newline}${socialLines.join(newline)}${newline}---${newline}`;
    nextContent = `${prefix}${fileContents}`;
  }

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
