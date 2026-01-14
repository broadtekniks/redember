/**
 * Simple and safe markdown-to-HTML converter for product descriptions
 * Supports: bold, italic, links, lists, line breaks
 */

export function renderMarkdown(text: string | null | undefined): string {
  if (!text) return "";

  let html = text
    // Escape HTML to prevent XSS
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")

    // Bold: **text** or __text__
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")

    // Italic: *text* or _text_
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_(.+?)_/g, "<em>$1</em>")

    // Links: [text](url)
    .replace(
      /\[(.+?)\]\((.+?)\)/g,
      '<a href="$2" class="text-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>'
    )

    // Bullet lists: lines starting with - or *
    .replace(/^[\-\*]\s+(.+)$/gm, "<li>$1</li>")

    // Wrap consecutive <li> items in <ul>
    .replace(
      /(<li>.*<\/li>\n?)+/g,
      (match) =>
        `<ul class="list-disc list-inside space-y-1 my-2">${match}</ul>`
    )

    // Paragraphs: double line breaks
    .split("\n\n")
    .map((para) =>
      para.trim()
        ? `<p class="mb-4 last:mb-0">${para.replace(/\n/g, "<br />")}</p>`
        : ""
    )
    .join("");

  return html;
}
