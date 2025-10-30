import type { AnyExtension } from "@tiptap/core";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

export const DEFAULT_EDITOR_PLACEHOLDER =
  "Write your knowledge base article content…";

function baseExtensions(): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4],
      },
      codeBlock: {
        HTMLAttributes: {
          class: "rounded-lg border bg-muted/40 p-4 font-mono text-sm",
        },
      },
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
    }),
  ];
}

export function createMarkdownExtensions(
  placeholder: string = DEFAULT_EDITOR_PLACEHOLDER
): AnyExtension[] {
  return [
    ...baseExtensions(),
    Markdown.configure({
      html: false,
      tightLists: true,
      bulletListMarker: "-",
      transformCopiedText: true,
      transformPastedText: true,
    }),
    Placeholder.configure({
      placeholder,
      includeChildren: true,
    }),
  ];
}
