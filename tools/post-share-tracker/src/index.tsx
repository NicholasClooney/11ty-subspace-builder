import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Text, render, useInput } from "ink";
import SelectInput from "ink-select-input";
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

type Mode = "post" | "channel" | "status" | "saving";

type SelectItem<Value> = {
  label: string;
  value: Value;
  key?: string;
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

const PostRow: React.FC<{ post: PostMeta }> = ({ post }) => (
  <Box>
    <Box width={TITLE_COLUMN_WIDTH}>
      <Text>{post.title}</Text>
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
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchPosts = useCallback(async () => {
    const loaded = await loadPosts();
    setPosts(loaded);
    setLoadError(null);
    setRefreshKey((key) => key + 1);
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
    (_, key) => {
      if (key.escape) {
        setActionError(null);
        setStatusMessage(null);
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
    },
    {
      isActive:
        !isInitialLoading && loadError === null && posts.length > 0 && mode !== "saving",
    }
  );

  const postItems = useMemo<SelectItem<string>[]>(() => {
    return posts.map((post) => {
      const summary = SOCIAL_CHANNELS.map((channel) => {
        const status = post.social?.[channel]?.status ?? "—";
        return `${channel}:${status}`;
      }).join("  ");

      return {
        label: summary ? `${post.title} — ${summary}` : post.title,
        value: post.filepath,
        key: post.filepath,
      };
    });
  }, [posts]);

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
          <SelectInput<string>
            key={`post-${refreshKey}`}
            items={postItems}
            onSelect={handlePostSelect}
          />
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
          <SelectInput<SocialChannel>
            key={`channel-${selectedPost.filepath}-${refreshKey}`}
            items={channelItems}
            onSelect={handleChannelSelect}
          />
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
          <SelectInput<SocialState>
            key={`status-${selectedChannel}-${refreshKey}`}
            items={statusItems}
            onSelect={handleStatusSelect}
          />
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
        <HeaderRow />
        {posts.map((post) => (
          <PostRow key={post.filepath} post={post} />
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {statusMessage && <Text color="green">{statusMessage}</Text>}
        {actionError && <Text color="red">{actionError}</Text>}
        {interactiveState}
      </Box>
    </Box>
  );
};

render(<App />);
