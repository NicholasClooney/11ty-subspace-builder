export default function excerpt(content, paragraphCount = 2) {
  if (!content) return '';
  const html = String(content);
  const paragraphRegex = /<p\b[^>]*>[\s\S]*?<\/p>/gi;
  const paragraphs = html.match(paragraphRegex);
  if (paragraphs && paragraphs.length) {
    return paragraphs.slice(0, paragraphCount).join('').trim();
  }
  const textChunks = html
    .replace(/<[^>]*>/g, '\n')
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return textChunks.slice(0, paragraphCount).join('\n\n');
}
