/**
 * Check if HTML string contains only tags with no visible text content.
 */
export function isEmptyHtml(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim().length === 0;
}

/**
 * Client-side HTML sanitizer using DOMParser.
 * Strips all tags except a safe subset, removes event handlers and javascript: URLs.
 */
const ALLOWED_TAGS = new Set([
  "p", "br", "strong", "em", "s", "u",
  "h2", "h3",
  "ul", "ol", "li",
  "a", "img",
  "blockquote", "code", "pre",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height"]),
};

export function sanitizeHtmlClient(html: string): string {
  if (typeof window === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  function walk(node: Node): void {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as Element;
        const tag = el.tagName.toLowerCase();

        if (!ALLOWED_TAGS.has(tag)) {
          // Replace disallowed tag with its children
          while (el.firstChild) {
            el.parentNode?.insertBefore(el.firstChild, el);
          }
          el.parentNode?.removeChild(el);
          continue;
        }

        // Remove disallowed attributes
        const allowedAttrs = ALLOWED_ATTRS[tag] ?? new Set<string>();
        for (const attr of Array.from(el.attributes)) {
          if (!allowedAttrs.has(attr.name)) {
            el.removeAttribute(attr.name);
          }
        }

        // Remove javascript: URLs
        const href = el.getAttribute("href");
        if (href && !/^https?:\/\//i.test(href)) {
          el.removeAttribute("href");
        }
        const src = el.getAttribute("src");
        if (src && !/^https?:\/\//i.test(src) && !src.startsWith("/")) {
          el.removeAttribute("src");
        }

        // Enforce safe link attributes
        if (tag === "a") {
          el.setAttribute("target", "_blank");
          el.setAttribute("rel", "noopener noreferrer");
        }

        walk(el);
      }
    }
  }

  walk(doc.body);
  return doc.body.innerHTML;
}
