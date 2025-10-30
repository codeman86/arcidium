import type { Element, Properties } from 'hast';
import type { Plugin } from 'unified';
import type { Root } from 'hast';

type HastNode = Root | Element | { type: string; children?: HastNode[] };

const ALLOWED_ELEMENTS = new Set([
  'a',
  'abbr',
  'blockquote',
  'br',
  'code',
  'del',
  'em',
  'figcaption',
  'figure',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'hr',
  'img',
  'li',
  'mark',
  'ol',
  'p',
  'pre',
  'strong',
  'sub',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'ul',
]);

const GLOBAL_ATTRIBUTES = new Set([
  'aria-describedby',
  'aria-hidden',
  'aria-label',
  'aria-labelledby',
  'role',
  'title',
]);

const ELEMENT_ATTRIBUTES: Record<string, Set<string>> = {
  a: new Set(['href', 'rel', 'target']),
  blockquote: new Set(['cite']),
  code: new Set(['className']),
  img: new Set(['alt', 'height', 'src', 'title', 'width']),
  pre: new Set(['className']),
  table: new Set(['align']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
};

export const rehypeSanitize: Plugin<[], Root> = function () {
  return (tree) => {
    sanitizeNode(tree);
  };
};

function sanitizeNode(node: HastNode) {
  if (!('children' in node) || !node.children) {
    return;
  }

  node.children = node.children.reduce<HastNode[]>((acc, child) => {
    if (child.type === 'text') {
      acc.push(child);
      return acc;
    }

    if (child.type === 'element') {
      const element = child as Element;
      if (!ALLOWED_ELEMENTS.has(element.tagName)) {
        // Drop disallowed element but preserve its textual children.
        extractTextContent(element, acc);
        return acc;
      }

      sanitizeProperties(element.tagName, element.properties ?? {});
      sanitizeNode(element);
      acc.push(element);
      return acc;
    }

    // Remove raw and unknown nodes entirely.
    if (child.type === 'raw') {
      return acc;
    }

    sanitizeNode(child);
    acc.push(child);
    return acc;
  }, []);
}

function sanitizeProperties(tagName: string, properties: Properties) {
  const allowedAttributes = ELEMENT_ATTRIBUTES[tagName] ?? new Set<string>();

  for (const key of Object.keys(properties)) {
    if (typeof key !== 'string') {
      delete properties[key];
      continue;
    }

    const lowerKey = key.toLowerCase();
    const value = properties[key];

    if (lowerKey.startsWith('on') || lowerKey === 'style') {
      delete properties[key];
      continue;
    }

    const isAllowed =
      GLOBAL_ATTRIBUTES.has(lowerKey) || allowedAttributes.has(lowerKey);
    if (!isAllowed) {
      delete properties[key];
      continue;
    }

    if (lowerKey === 'href' || lowerKey === 'src') {
      const safeValue =
        lowerKey === 'href'
          ? sanitizeHref(value)
          : sanitizeSource(value, tagName);
      if (!safeValue) {
        delete properties[key];
        continue;
      }
      properties[key] = safeValue;
      continue;
    }

    if (lowerKey === 'target') {
      if (typeof value !== 'string' || value.trim() === '') {
        delete properties[key];
        continue;
      }
      const normalized = value.trim();
      if (normalized !== '_self' && normalized !== '_blank') {
        delete properties[key];
        continue;
      }
      if (normalized === '_blank') {
        const relValue = properties.rel;
        const rel = typeof relValue === 'string' ? relValue : '';
        const enforced = enforceNoopener(rel);
        properties.rel = enforced;
      }
      properties[key] = normalized;
      continue;
    }

    if (lowerKey === 'rel') {
      if (typeof value !== 'string') {
        delete properties[key];
        continue;
      }
      properties[key] = enforceNoopener(value);
      continue;
    }

    if (lowerKey === 'className') {
      if (Array.isArray(value)) {
        properties[key] = value
          .map((entry) => (typeof entry === 'string' ? entry : ''))
          .filter(Boolean);
      } else if (typeof value !== 'string') {
        delete properties[key];
      }
    }
  }
}

function sanitizeHref(value: Properties[string]) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  if (
    trimmed.startsWith('#') ||
    trimmed.startsWith('/') ||
    trimmed.startsWith('./')
  ) {
    return trimmed;
  }

  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function sanitizeSource(value: Properties[string], tagName: string) {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed === '') {
    return null;
  }

  if (trimmed.startsWith('/') || trimmed.startsWith('./')) {
    return trimmed;
  }

  if (/^https?:/i.test(trimmed)) {
    return trimmed;
  }

  if (tagName === 'img' && /^data:image\//i.test(trimmed)) {
    return trimmed;
  }

  return null;
}

function enforceNoopener(rel: string) {
  const tokens = new Set(
    rel
      .split(/\s+/)
      .map((token) => token.trim().toLowerCase())
      .filter(Boolean)
  );
  tokens.add('noopener');
  tokens.add('noreferrer');
  return Array.from(tokens).join(' ');
}

function extractTextContent(node: Element, acc: HastNode[]) {
  if (!node.children) {
    return;
  }
  for (const child of node.children) {
    if (child.type === 'text') {
      acc.push(child);
    } else if (child.type === 'element') {
      extractTextContent(child as Element, acc);
    }
  }
}
