import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  disabled,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // StarterKit includes Link by default; we provide our own configured Link
        // to avoid duplicate extension names.
        link: false,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary hover:underline",
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || "Start typing...",
      }),
    ],
    content: value,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-950">
      {/* Toolbar */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
            editor.isActive("bold")
              ? "bg-primary text-white"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="Bold"
        >
          <span className="material-symbols-outlined text-[18px]">
            format_bold
          </span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
            editor.isActive("italic")
              ? "bg-primary text-white"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="Italic"
        >
          <span className="material-symbols-outlined text-[18px]">
            format_italic
          </span>
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
            editor.isActive("bulletList")
              ? "bg-primary text-white"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="Bullet List"
        >
          <span className="material-symbols-outlined text-[18px]">
            format_list_bulleted
          </span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
            editor.isActive("orderedList")
              ? "bg-primary text-white"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="Numbered List"
        >
          <span className="material-symbols-outlined text-[18px]">
            format_list_numbered
          </span>
        </button>

        <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

        <button
          type="button"
          onClick={() => {
            const url = window.prompt("Enter URL:");
            if (url) {
              editor.chain().focus().setLink({ href: url }).run();
            }
          }}
          disabled={disabled}
          className={`px-3 py-1.5 rounded text-sm font-bold transition-colors ${
            editor.isActive("link")
              ? "bg-primary text-white"
              : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          }`}
          title="Add Link"
        >
          <span className="material-symbols-outlined text-[18px]">link</span>
        </button>

        {editor.isActive("link") && (
          <button
            type="button"
            onClick={() => editor.chain().focus().unsetLink().run()}
            disabled={disabled}
            className="px-3 py-1.5 rounded text-sm font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title="Remove Link"
          >
            <span className="material-symbols-outlined text-[18px]">
              link_off
            </span>
          </button>
        )}
      </div>

      {/* Editor Content */}
      <EditorContent
        editor={editor}
        className="prose prose-sm dark:prose-invert max-w-none p-3 min-h-[160px] focus:outline-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[140px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-slate-400 [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0"
      />
    </div>
  );
}
