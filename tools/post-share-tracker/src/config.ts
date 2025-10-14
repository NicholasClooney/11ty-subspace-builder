import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

export interface TrackerConfig {
  social: {
    channels: string[];
    states: string[];
  };
}

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const configPath = path.join(repoRoot, "tools", "post-share-tracker", "config.yaml");

let cachedConfig: TrackerConfig | null = null;

const ensureStringArray = (value: unknown, label: string): string[] => {
  if (!Array.isArray(value)) {
    throw new Error(`Config error: ${label} must be an array.`);
  }

  const entries = value.map((entry) => {
    if (typeof entry !== "string" || entry.trim() === "") {
      throw new Error(`Config error: ${label} entries must be non-empty strings.`);
    }

    return entry.trim();
  });

  if (entries.length === 0) {
    throw new Error(`Config error: ${label} must contain at least one entry.`);
  }

  return Array.from(new Set(entries));
};

const loadConfig = (): TrackerConfig => {
  if (cachedConfig) {
    return cachedConfig;
  }

  const fileContents = fs.readFileSync(configPath, "utf8");
  const parsed = YAML.parse(fileContents) as Partial<TrackerConfig> | undefined;

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Config error: unable to parse tracker config.");
  }

  const channels = ensureStringArray(parsed.social?.channels, "social.channels");
  const states = ensureStringArray(parsed.social?.states, "social.states");

  cachedConfig = {
    social: {
      channels,
      states,
    },
  };

  return cachedConfig;
};

export const getTrackerConfig = (): TrackerConfig => loadConfig();

const trackerConfig = getTrackerConfig();

export const SOCIAL_CHANNELS = trackerConfig.social.channels;
export const SOCIAL_STATES = trackerConfig.social.states;

export type SocialChannel = (typeof SOCIAL_CHANNELS)[number];
export type SocialState = (typeof SOCIAL_STATES)[number];
