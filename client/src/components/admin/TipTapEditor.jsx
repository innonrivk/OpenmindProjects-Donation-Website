import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { useEffect } from 'react';
import './TipTapEditor.css';

/**
 * TipTapEditor — Brand-aligned rich text editor for WebsiteContent.body.
 *
 * @param {object} props
 * @param {string} props.value - Initial editor HTML content.
 * @param {function(string): void} props.onChange - Triggered when content updates.
 * @returns {JSX.Element}
 */
export default function TipTapEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        underline: false,
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'editor-link',
        },
      }),
    ],
    content: value || '',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Sync state changes from parent component (e.g. form resets)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '');
    }
  }, [value, editor]);

  if (!editor) return null;

  const toggleLink = () => {
    if (editor.isActive('link')) {
      editor.commands.unsetLink();
      return;
    }
    const url = window.prompt('Enter URL:');
    if (url) {
      editor.commands.setLink({ href: url });
    }
  };

  return (
    <div className="tiptap-editor-container">
      <div className="tiptap-toolbar">
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={editor.isActive('bold') ? 'active' : ''}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={editor.isActive('italic') ? 'active' : ''}
          title="Italic"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={editor.isActive('underline') ? 'active' : ''}
          title="Underline"
        >
          <u>U</u>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={editor.isActive('heading', { level: 2 }) ? 'active' : ''}
          title="Heading 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={editor.isActive('bulletList') ? 'active' : ''}
          title="Bullet List"
        >
          • List
        </button>
        <button
          type="button"
          onClick={toggleLink}
          className={editor.isActive('link') ? 'active' : ''}
          title="Link"
        >
          Link
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          title="Undo"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          title="Redo"
        >
          ↪
        </button>
      </div>
      <EditorContent editor={editor} className="tiptap-content-area" />
    </div>
  );
}
