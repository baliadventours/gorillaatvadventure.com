import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Heading1, Heading2, Heading3, Bold, Italic, 
  List, ListOrdered, Quote, Link as LinkIcon, 
  Image as ImageIcon, Undo, Redo, Code
} from 'lucide-react';
import { cn } from '../lib/utils';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
}

const MenuButton = ({ 
  onClick, 
  active, 
  disabled, 
  children,
  title
}: { 
  onClick: () => void; 
  active?: boolean; 
  disabled?: boolean;
  children: React.ReactNode;
  title?: string;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(
      "p-2 rounded-lg transition-all",
      active 
        ? "bg-orange-100 text-primary" 
        : "text-gray-500 hover:bg-gray-100"
    )}
  >
    {children}
  </button>
);

export default function RichTextEditor({ content, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline font-bold',
        },
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'rounded-[20px] shadow-lg max-w-full h-auto my-8',
        },
      }),
      Placeholder.configure({
        placeholder: placeholder || 'Start writing your story...',
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-orange max-w-none focus:outline-none min-h-[400px] p-4 text-gray-700 leading-relaxed',
      },
    },
  });

  // Update editor content when prop changes (e.g. from AI generation)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  const addImage = () => {
    const url = window.prompt('URL of the image:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="border-2 border-gray-100 rounded-2xl overflow-hidden bg-white focus-within:border-primary transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-gray-50 border-b border-gray-100">
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          active={editor.isActive('heading', { level: 1 })}
          title="Heading 1"
        >
          <Heading1 size={18} />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          active={editor.isActive('heading', { level: 2 })}
          title="Heading 2"
        >
          <Heading2 size={18} />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          active={editor.isActive('heading', { level: 3 })}
          title="Heading 3"
        >
          <Heading3 size={18} />
        </MenuButton>
        
        <div className="w-[2px] h-6 bg-gray-200 mx-1" />

        <MenuButton 
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={18} />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={18} />
        </MenuButton>
        
        <div className="w-[2px] h-6 bg-gray-200 mx-1" />

        <MenuButton 
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={18} />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </MenuButton>
        <MenuButton 
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote size={18} />
        </MenuButton>

        <div className="w-[2px] h-6 bg-gray-200 mx-1" />

        <MenuButton onClick={setLink} active={editor.isActive('link')} title="Link">
          <LinkIcon size={18} />
        </MenuButton>
        <MenuButton onClick={addImage} title="Add External Image">
          <ImageIcon size={18} />
        </MenuButton>
        
        <div className="w-[2px] h-6 bg-gray-200 mx-1" />

        <MenuButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
          <Undo size={18} />
        </MenuButton>
        <MenuButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
          <Redo size={18} />
        </MenuButton>
      </div>

      <EditorContent editor={editor} className="bg-white" />
    </div>
  );
}
