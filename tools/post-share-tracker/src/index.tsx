import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";
import {
  SOCIAL_CHANNELS,
  SOCIAL_STATES,
  type SocialChannel,
  type SocialState,
} from "./config.js";
import type { PostMeta, SocialStatus } from "./loadPosts.js";
import { loadPosts } from "./loadPosts.js";
import { savePostSocial } from "./savePostSocial.js";

const TITLE_COLUMN_WIDTH = 40;
const STATUS_COLUMN_WIDTH = 18;
const POINTER_COLUMN_WIDTH = 2;

type Mode = "post" | "channel" | "status" | "saving";

type SelectItem<Value> = {
  label: string;
  value: Value;
  key?: string;
};

const buildChannelSummary = (post: PostMeta): string => {
  return SOCIAL_CHANNELS.map((channel) => {
    const status = post.social?.[channel]?.status ?? "—";
    return `${channel}:${status}`;
  }).join("  ");
};

const buildPostLabel = (post: PostMeta): string => {
  const summary = buildChannelSummary(post);
  return summary ? `${post.title} — ${summary}` : post.title;
};

const toFilterTokens = (filter: string): string[] => {
  return filter
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
};

const matchesTokens = (value: string, tokens: string[]): boolean => {
  if (tokens.length === 0) {
    return true;
  }

  const haystack = value.toLowerCase();
  let searchIndex = 0;

  for (const token of tokens) {
    const foundIndex = haystack.indexOf(token, searchIndex);
    if (foundIndex === -1) {
      return false;
    }

    searchIndex = foundIndex + token.length;
  }

  return true;
};

interface SelectableListProps<Value> {
  items: SelectItem<Value>[];
  isActive: boolean;
  onSelect: (item: SelectItem<Value>) => void | Promise<void>;
  itemKeyPrefix: string;
  emptyPlaceholder?: React.ReactNode;
  renderItem?: (item: SelectItem<Value>, isSelected: boolean) => React.ReactNode;
}

const SelectableList = <Value,>({
  items,
  isActive,
  onSelect,
  itemKeyPrefix,
  emptyPlaceholder,
  renderItem,
}: SelectableListProps<Value>) => {
  const [highlightIndex, setHighlightIndex] = useState(0);

  useEffect(() => {
    setHighlightIndex((current) => {
      if (items.length === 0) {
        return 0;
      }

      return Math.min(current, items.length - 1);
    });
  }, [items]);

  useEffect(() => {
    if (items.length === 0) {
      setHighlightIndex(0);
    }
  }, [items.length]);

  useInput(
    (input, key) => {
      if (items.length === 0) {
        return;
      }

      if (key.upArrow || input === "k") {
        setHighlightIndex((current) => {
          if (current === 0) {
            return items.length - 1;
          }

          return current - 1;
        });
        return;
      }

      if (key.downArrow || input === "j") {
        setHighlightIndex((current) => (current + 1) % items.length);
        return;
      }

      if (key.return) {
        const item = items[highlightIndex];
        if (item) {
          void onSelect(item);
        }
      }
    },
    { isActive }
  );

  if (items.length === 0) {
    return emptyPlaceholder ? <>{emptyPlaceholder}</> : null;
  }

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === highlightIndex;
        const pointerColor = isSelected ? "cyan" : "gray";
        return (
          <Box key={item.key ?? `${itemKeyPrefix}-${index}`} flexDirection="row">
            <Box width={POINTER_COLUMN_WIDTH}>
              <Text color={pointerColor}>{isSelected ? "›" : " "}</Text>
            </Box>
            <Box flexGrow={1}>
              {renderItem ? (
                renderItem(item, isSelected)
              ) : (
                <Text color={isSelected ? "cyan" : undefined}>{item.label}</Text>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
};

const getStatusColor = (status?: SocialStatus): string => {
  if (!status) {
    return "gray";
  }

  switch (status.status) {
    case "shared":
      return "green";
    case "queued":
      return "yellow";
    case "draft":
    default:
      return "magenta";
  }
};

const formatStatusLabel = (status?: SocialStatus): string => {
  if (!status) {
    return "—";
  }

  return status.lastShared ? `${status.status} (${status.lastShared})` : status.status;
};

const HeaderRow: React.FC = () => (
  <Box>
    <Box width={TITLE_COLUMN_WIDTH}>
      <Text bold>Post</Text>
    </Box>
    {SOCIAL_CHANNELS.map((channel) => (
      <Box key={channel} width={STATUS_COLUMN_WIDTH}>
        <Text bold>{channel}</Text>
      </Box>
    ))}
  </Box>
);

const PostRow: React.FC<{ post: PostMeta; isSelected?: boolean }> = ({
  post,
  isSelected = false,
}) => (
  <Box>
    <Box width={TITLE_COLUMN_WIDTH}>
      <Text color={isSelected ? "cyan" : undefined}>{post.title}</Text>
    </Box>
    {SOCIAL_CHANNELS.map((channel) => {
      const status = post.social?.[channel];
      return (
        <Box key={channel} width={STATUS_COLUMN_WIDTH}>
          <Text color={getStatusColor(status)}>{formatStatusLabel(status)}</Text>
        </Box>
      );
    })}
  </Box>
);

const App: React.FC = () => {
  const [posts, setPosts] = useState<PostMeta[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("post");
  const [selectedPostPath, setSelectedPostPath] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<SocialChannel | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postFilter, setPostFilter] = useState("");

  const fetchPosts = useCallback(async () => {
    const loaded = await loadPosts();
    setPosts(loaded);
    setLoadError(null);
    return loaded;
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        await fetchPosts();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setLoadError(message);
      } finally {
        setIsInitialLoading(false);
      }
    };

    void load();
  }, [fetchPosts]);

  const selectedPost = useMemo<PostMeta | null>(() => {
    return posts.find((post) => post.filepath === selectedPostPath) ?? null;
  }, [posts, selectedPostPath]);

  useEffect(() => {
    if (selectedPostPath && !selectedPost) {
      setSelectedPostPath(null);
      setSelectedChannel(null);
      setMode("post");
    }
  }, [selectedPostPath, selectedPost]);

  useInput(
    (input, key) => {
      if (key.escape) {
        setActionError(null);
        setStatusMessage(null);
        if (mode === "post" && postFilter.length > 0) {
          setPostFilter("");
          return;
        }
        if (mode === "status") {
          setMode("channel");
          setSelectedChannel(null);
          return;
        }

        if (mode === "channel") {
          setMode("post");
          setSelectedPostPath(null);
          setSelectedChannel(null);
        }
      }

      if (mode === "post") {
        if ((key.backspace || key.delete) && postFilter.length > 0) {
          setPostFilter((current) => current.slice(0, -1));
          return;
        }

        const isModifierPressed = key.ctrl || key.meta;
        const isNavigationKey =
          key.return || key.upArrow || key.downArrow || key.leftArrow || key.rightArrow || key.pageDown || key.pageUp || key.tab;

        if (!isModifierPressed && !isNavigationKey && input && input >= " ") {
          setPostFilter((current) => `${current}${input}`);
        }
      }
    },
    {
      isActive:
        !isInitialLoading && loadError === null && posts.length > 0 && mode !== "saving",
    }
  );

  const filterTokens = useMemo(
    () => toFilterTokens(postFilter),
    [postFilter]
  );

  const filteredPosts = useMemo(() => {
    if (filterTokens.length === 0) {
      return posts;
    }

    return posts.filter((post) => {
      const summary = buildChannelSummary(post);
      const haystacks = [
        post.title,
        post.slug,
        post.filepath,
        summary,
        ...SOCIAL_CHANNELS.map((channel) => post.social?.[channel]?.status ?? ""),
      ].filter((value): value is string => Boolean(value));

      return haystacks.some((value) => matchesTokens(value, filterTokens));
    });
  }, [filterTokens, posts]);

  const postsByPath = useMemo(() => {
    const map = new Map<string, PostMeta>();
    filteredPosts.forEach((post) => {
      map.set(post.filepath, post);
    });
    return map;
  }, [filteredPosts]);

  const postItems = useMemo<SelectItem<string>[]>(() => {
    return filteredPosts.map((post) => {
      return {
        label: buildPostLabel(post),
        value: post.filepath,
        key: post.filepath,
      };
    });
  }, [filteredPosts]);

  const channelItems = useMemo<SelectItem<SocialChannel>[]>(() => {
    if (!selectedPost) {
      return [];
    }

    return SOCIAL_CHANNELS.map((channel) => {
      const status = selectedPost.social?.[channel];
      return {
        label: `${channel} — ${formatStatusLabel(status)}`,
        value: channel,
        key: `${selectedPost.filepath}:${channel}`,
      };
    });
  }, [selectedPost]);

  const statusItems = useMemo<SelectItem<SocialState>[]>(() => {
    if (!selectedPost || !selectedChannel) {
      return [];
    }

    const currentStatus = selectedPost.social?.[selectedChannel]?.status;

    return SOCIAL_STATES.map((state) => ({
      label: state === currentStatus ? `${state} (current)` : state,
      value: state,
      key: state,
    }));
  }, [selectedChannel, selectedPost]);

  const handlePostSelect = (item: SelectItem<string>) => {
    setSelectedPostPath(item.value);
    setSelectedChannel(null);
    setMode("channel");
    setStatusMessage(null);
    setActionError(null);
    setPostFilter("");
  };

  const handleChannelSelect = (item: SelectItem<SocialChannel>) => {
    setSelectedChannel(item.value);
    setMode("status");
    setStatusMessage(null);
    setActionError(null);
  };

  const handleStatusSelect = async (item: SelectItem<SocialState>) => {
    if (!selectedPost || !selectedChannel) {
      setActionError("Select a post and channel before choosing a status.");
      setMode(selectedPost ? "channel" : "post");
      return;
    }

    setMode("saving");
    setActionError(null);
    setStatusMessage(null);

    try {
      const result = await savePostSocial({
        filepath: selectedPost.filepath,
        channel: selectedChannel,
        status: item.value,
        options: {
          autoTimestamp: true,
        },
      });

      try {
        await fetchPosts();
      } catch (reloadError) {
        const message =
          reloadError instanceof Error ? reloadError.message : String(reloadError);
        setActionError(
          `Status updated but refreshing posts failed: ${message}`
        );
        return;
      }

      if (result.changed) {
        const parts = [
          selectedPost.title,
          `${selectedChannel} → ${result.status.status}`,
        ];

        if (result.status.lastShared) {
          parts.push(`lastShared ${result.status.lastShared}`);
        }

        setStatusMessage(`Updated ${parts.join(" · ")}`);
      } else {
        setStatusMessage(
          `No changes written. ${selectedChannel} already ${result.status.status}.`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setActionError(message);
    } finally {
      setMode("channel");
      setSelectedChannel(null);
    }
  };

  if (isInitialLoading) {
    return <Text>Loading posts…</Text>;
  }

  if (loadError) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to load posts:</Text>
        <Text color="red">{loadError}</Text>
        <Text color="gray">Fix the issue and restart the tracker.</Text>
      </Box>
    );
  }

  if (posts.length === 0) {
    return <Text>No posts found.</Text>;
  }

  const interactiveState = (() => {
    if (mode === "saving") {
      return <Text color="yellow">Saving status update…</Text>;
    }

    if (mode === "post") {
      return (
        <Box flexDirection="column">
          <Text>Select a post to update (Enter).</Text>
          <Text color="gray">
            Type to filter by title/slug. Backspace edits. Esc clears the filter.
          </Text>
          {postFilter ? (
            <Text color="gray">Filter: “{postFilter}”</Text>
          ) : null}
          <Box marginTop={1} flexDirection="column">
            <Box flexDirection="row">
              <Box width={POINTER_COLUMN_WIDTH} />
              <HeaderRow />
            </Box>
            <SelectableList<string>
              items={postItems}
              isActive={mode === "post" && actionError === null}
              onSelect={handlePostSelect}
              itemKeyPrefix="post"
              emptyPlaceholder={
                <Text color="yellow">
                  No posts match the filter. Adjust your search or press Esc to clear.
                </Text>
              }
              renderItem={(item, isSelected) => {
                const postForRow = postsByPath.get(item.value);
                if (!postForRow) {
                  return <Text color={isSelected ? "cyan" : undefined}>{item.label}</Text>;
                }

                return <PostRow post={postForRow} isSelected={isSelected} />;
              }}
            />
          </Box>
        </Box>
      );
    }

    if (mode === "channel" && selectedPost) {
      return (
        <Box flexDirection="column">
          <Text>
            Post: <Text bold>{selectedPost.title}</Text>
          </Text>
          <Text>
            Select a channel to update (Enter). Press Esc to choose a different post.
          </Text>
          <Box marginTop={1} flexDirection="column">
            <Box flexDirection="row">
              <Box width={POINTER_COLUMN_WIDTH} />
              <Box width={STATUS_COLUMN_WIDTH}>
                <Text bold>Channel</Text>
              </Box>
              <Box width={STATUS_COLUMN_WIDTH}>
                <Text bold>Status</Text>
              </Box>
            </Box>
            <SelectableList<SocialChannel>
              items={channelItems}
              isActive={mode === "channel" && actionError === null}
              onSelect={handleChannelSelect}
              itemKeyPrefix={`channel-${selectedPost.filepath}`}
              renderItem={(item, isSelected) => {
                const status = selectedPost.social?.[item.value];
                return (
                  <Box flexDirection="row">
                    <Box width={STATUS_COLUMN_WIDTH}>
                      <Text color={isSelected ? "cyan" : undefined}>{item.value}</Text>
                    </Box>
                    <Box width={STATUS_COLUMN_WIDTH}>
                      <Text color={getStatusColor(status)}>
                        {formatStatusLabel(status)}
                      </Text>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>
        </Box>
      );
    }

    if (mode === "status" && selectedPost && selectedChannel) {
      const currentStatus = selectedPost.social?.[selectedChannel];
      return (
        <Box flexDirection="column">
          <Text>
            Channel: <Text bold>{selectedChannel}</Text>{" "}
            <Text color="gray">{formatStatusLabel(currentStatus)}</Text>
          </Text>
          <Text>Select a new status (Enter). Press Esc to reselect the channel.</Text>
          <Box marginTop={1} flexDirection="column">
            <Box flexDirection="row">
              <Box width={POINTER_COLUMN_WIDTH} />
              <Box width={STATUS_COLUMN_WIDTH}>
                <Text bold>Status</Text>
              </Box>
              <Box width={TITLE_COLUMN_WIDTH}>
                <Text bold>Details</Text>
              </Box>
            </Box>
            <SelectableList<SocialState>
              items={statusItems}
              isActive={mode === "status" && actionError === null}
              onSelect={handleStatusSelect}
              itemKeyPrefix={`status-${selectedChannel}`}
              renderItem={(item, isSelected) => {
                const isCurrent = item.value === currentStatus?.status;
                return (
                  <Box flexDirection="row">
                    <Box width={STATUS_COLUMN_WIDTH}>
                      <Text color={isSelected ? "cyan" : undefined}>{item.value}</Text>
                    </Box>
                    <Box width={TITLE_COLUMN_WIDTH}>
                      <Text color={isCurrent ? "green" : "gray"}>
                        {isCurrent ? "Already current status" : "Set channel to this state"}
                      </Text>
                    </Box>
                  </Box>
                );
              }}
            />
          </Box>
        </Box>
      );
    }

    return <Text color="gray">Select a post to begin.</Text>;
  })();

  return (
    <Box flexDirection="column">
      <Text color="cyan">Post Share Tracker</Text>
      <Text>
        Tracking {posts.length} post{posts.length === 1 ? "" : "s"} across{" "}
        {SOCIAL_CHANNELS.length} channel{SOCIAL_CHANNELS.length === 1 ? "" : "s"}.
      </Text>
      <Box marginTop={1} flexDirection="column">
        {statusMessage && <Text color="green">{statusMessage}</Text>}
        {actionError && <Text color="red">{actionError}</Text>}
        {interactiveState}
      </Box>
    </Box>
  );
};

render(<App />);
