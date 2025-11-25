'use client';

import * as React from 'react';
import {
  Bold,
  Code,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo,
  Undo,
} from 'lucide-react';
import { EditorContent, useEditor } from '@tiptap/react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  DEFAULT_EDITOR_PLACEHOLDER,
  createMarkdownExtensions,
} from '@/lib/editor/markdown';

type MarkdownEditorProps = {
  value: string;
  onChange?: (markdown: string) => void;
  placeholder?: string;
  disabled?: boolean;
};

export function MarkdownEditor({
  value,
  onChange,
  placeholder = DEFAULT_EDITOR_PLACEHOLDER,
  disabled = false,
}: MarkdownEditorProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const editor = useEditor({
    editable: !disabled,
    extensions: createMarkdownExtensions(placeholder),
    content: value ?? '',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          'prose prose-slate dark:prose-invert max-w-none focus:outline-none min-h-[320px]',
      },
    },
    onUpdate({ editor }) {
      if (!onChange) return;
      const markdown = getMarkdownFromStorage(editor);
      if (typeof markdown === 'string') {
        onChange(markdown);
      }
    },
  });

  React.useEffect(() => {
    if (!editor) return;
    const current = getMarkdownFromStorage(editor);
    if (current !== value) {
      editor.commands.setContent(value ?? '');
    }
  }, [editor, value]);

  if (!mounted || !editor) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-sm text-muted-foreground">
        Loading editor…
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <EditorToolbar editor={editor} disabled={disabled} />
      <div
        className={cn(
          'rounded-lg border bg-card shadow-sm transition focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2',
          disabled && 'opacity-60'
        )}
      >
        <EditorContent editor={editor} className="px-4 py-6" />
      </div>
    </div>
  );
}

function getMarkdownFromStorage(
  editor: NonNullable<ReturnType<typeof useEditor>>
) {
  const storage = editor.storage as {
    markdown?: {
      getMarkdown: () => string;
    };
  };
  return storage.markdown?.getMarkdown();
}

type EditorToolbarProps = {
  editor: NonNullable<ReturnType<typeof useEditor>>;
  disabled?: boolean;
};

function EditorToolbar({ editor, disabled = false }: EditorToolbarProps) {
  const apply = React.useCallback(
    (callback: () => void) => () => {
      if (disabled) return;
      editor.chain().focus();
      callback();
    },
    [disabled, editor]
  );

  const actions = [
    {
      label: 'Undo',
      icon: Undo,
      action: () => editor.chain().focus().undo().run(),
      isActive: () => false,
    },
    {
      label: 'Redo',
      icon: Redo,
      action: () => editor.chain().focus().redo().run(),
      isActive: () => false,
    },
    'divider',
    {
      label: 'Heading 1',
      icon: Heading1,
      action: () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
      isActive: () => editor.isActive('heading', { level: 1 }),
    },
    {
      label: 'Heading 2',
      icon: Heading2,
      action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.isActive('heading', { level: 2 }),
    },
    {
      label: 'Heading 3',
      icon: Heading3,
      action: () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
      isActive: () => editor.isActive('heading', { level: 3 }),
    },
    'divider',
    {
      label: 'Bold',
      icon: Bold,
      action: () => editor.chain().focus().toggleBold().run(),
      isActive: () => editor.isActive('bold'),
    },
    {
      label: 'Italic',
      icon: Italic,
      action: () => editor.chain().focus().toggleItalic().run(),
      isActive: () => editor.isActive('italic'),
    },
    {
      label: 'Code',
      icon: Code,
      action: () => editor.chain().focus().toggleCode().run(),
      isActive: () => editor.isActive('code'),
    },
    {
      label: 'Code block',
      icon: Code2,
      action: () => editor.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.isActive('codeBlock'),
    },
    'divider',
    {
      label: 'Bullet list',
      icon: List,
      action: () => editor.chain().focus().toggleBulletList().run(),
      isActive: () => editor.isActive('bulletList'),
    },
    {
      label: 'Ordered list',
      icon: ListOrdered,
      action: () => editor.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.isActive('orderedList'),
    },
    {
      label: 'Quote',
      icon: Quote,
      action: () => editor.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.isActive('blockquote'),
    },
  ] as const;

  return (
    <div className="flex flex-wrap gap-1 rounded-lg border bg-muted/40 p-1">
      {actions.map((entry, index) =>
        entry === 'divider' ? (
          <span
            key={`divider-${index}`}
            className="mx-1 h-6 w-px bg-border last:hidden"
            aria-hidden="true"
          />
        ) : (
          <Button
            key={entry.label}
            type="button"
            variant={entry.isActive() ? 'secondary' : 'ghost'}
            size="sm"
            className="h-9 w-9 p-0"
            onClick={apply(() => entry.action())}
            aria-label={entry.label}
            disabled={disabled}
          >
            <entry.icon className="h-4 w-4" />
          </Button>
        )
      )}
    </div>
  );
}
