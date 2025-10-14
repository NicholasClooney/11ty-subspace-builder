import React, { useEffect, useState } from "react";
import { Box, Text, render } from "ink";
import type { PostMeta, SocialStatus } from "./loadPosts.js";
import { SOCIAL_PLATFORMS, loadPosts } from "./loadPosts.js";

const TITLE_COLUMN_WIDTH = 40;
const STATUS_COLUMN_WIDTH = 16;

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

  return status.lastShared
    ? `${status.status} (${status.lastShared})`
    : status.status;
};

const HeaderRow: React.FC = () => (
  <Box>
    <Box width={TITLE_COLUMN_WIDTH}>
      <Text bold>Post</Text>
    </Box>
    {SOCIAL_PLATFORMS.map((platform) => (
      <Box key={platform} width={STATUS_COLUMN_WIDTH}>
        <Text bold>{platform}</Text>
      </Box>
    ))}
  </Box>
);

const PostRow: React.FC<{ post: PostMeta }> = ({ post }) => (
  <Box>
    <Box width={TITLE_COLUMN_WIDTH}>
      <Text>{post.title}</Text>
    </Box>
    {SOCIAL_PLATFORMS.map((platform) => {
      const status = post.social?.[platform];
      return (
        <Box key={platform} width={STATUS_COLUMN_WIDTH}>
          <Text color={getStatusColor(status)}>{formatStatusLabel(status)}</Text>
        </Box>
      );
    })}
  </Box>
);

const App: React.FC = () => {
  const [posts, setPosts] = useState<PostMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const loaded = await loadPosts();
        setPosts(loaded);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      }
    };

    void load();
  }, []);

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color="red">Failed to load posts:</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (!posts) {
    return <Text>Loading posts…</Text>;
  }

  if (posts.length === 0) {
    return <Text>No posts found.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">Post Share Tracker</Text>
      <Text>
        Tracking {posts.length} post{posts.length === 1 ? "" : "s"} across {SOCIAL_PLATFORMS.length} platform
        {SOCIAL_PLATFORMS.length === 1 ? "" : "s"}.
      </Text>
      <Box marginTop={1} flexDirection="column">
        <HeaderRow />
        {posts.map((post) => (
          <PostRow key={post.filepath} post={post} />
        ))}
      </Box>
    </Box>
  );
};

render(<App />);
