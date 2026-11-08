"use client";

import { useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import {
  Bold,
  Italic,
  Strikethrough,
  Heading2,
  List,
  ListOrdered,
  Link as LinkIcon,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface RichTextEditorProps {
  content?: string;
  onChange: (html: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function RichTextEditor({ content = "", onChange, placeholder = "Tulis catatan…", disabled = false }: RichTextEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        // StarterKit v3 sudah membawa extension Link sendiri. Dibiarkan aktif,
        // ia bentrok dengan Link.configure() di bawah ("Duplicate extension
        // names found: ['link']") dan opsi di sini yang menang secara diam-diam.
        link: false,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    editable: !disabled,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Editor teks",
        class: "tiptap-editor min-h-[120px] px-3 py-2 text-base prose-comment",
      },
    },
  });

  if (!editor) return null;

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editor) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Upload failed");
      }

      const { url } = await res.json();
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Gagal upload gambar");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handleLink() {
    const previousUrl = editor!.getAttributes("link").href;
    const url = window.prompt("URL:", previousUrl);
    if (url === null) return;
    if (url === "") {
      editor!.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      // Hanya izinkan http/https URLs
      if (!/^https?:\/\//i.test(url)) {
        toast.error("URL harus dimulai dengan http:// atau https://");
        return;
      }
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }

  // Tombol bilah alat: ghost icon-sm; status aktif dibawa aria-pressed + latar secondary.
  const tools = [
    { label: "Tebal", icon: Bold, active: editor.isActive("bold"), run: () => editor.chain().focus().toggleBold().run() },
    { label: "Miring", icon: Italic, active: editor.isActive("italic"), run: () => editor.chain().focus().toggleItalic().run() },
    { label: "Coret", icon: Strikethrough, active: editor.isActive("strike"), run: () => editor.chain().focus().toggleStrike().run() },
    null,
    { label: "Judul", icon: Heading2, active: editor.isActive("heading", { level: 2 }), run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: "Daftar poin", icon: List, active: editor.isActive("bulletList"), run: () => editor.chain().focus().toggleBulletList().run() },
    { label: "Daftar bernomor", icon: ListOrdered, active: editor.isActive("orderedList"), run: () => editor.chain().focus().toggleOrderedList().run() },
    null,
    { label: "Tautan", icon: LinkIcon, active: editor.isActive("link"), run: handleLink },
  ];

  return (
    // Permukaan field: tepi 3:1 tetap, fokus berupa outline sisipan, bukan perubahan tepi.
    <div className="rounded-md border border-input bg-card outline-2 outline-offset-[-3px] outline-transparent focus-within:outline-ring">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b px-1.5 py-1">
        {tools.map((tool, i) =>
          tool ? (
            <Button
              key={tool.label}
              type="button"
              variant={tool.active ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={tool.run}
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={tool.active}
            >
              <tool.icon aria-hidden />
            </Button>
          ) : (
            <div key={`sep-${i}`} aria-hidden className="mx-1 h-4 w-px bg-border" />
          )
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Unggah gambar"
          aria-label="Unggah gambar"
        >
          {uploading ? <Loader2 aria-hidden className="animate-spin motion-reduce:animate-none" /> : <ImagePlus aria-hidden />}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={handleImageUpload}
        />
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
