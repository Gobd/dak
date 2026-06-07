export function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .split('\n')
    .map((line) => `<p>${line}</p>`)
    .join('');
}
