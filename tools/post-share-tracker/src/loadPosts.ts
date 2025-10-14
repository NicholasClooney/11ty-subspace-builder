export interface PostMeta {
  slug: string;
  title: string;
}

export const loadPosts = async (): Promise<PostMeta[]> => {
  return [];
};
