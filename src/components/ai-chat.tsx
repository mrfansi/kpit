"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, X, Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function AIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataDate, setDataDate] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: updatedMessages.slice(-20),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Gagal mendapatkan jawaban");
      }

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      if (data.dataDate) setDataDate(data.dataDate);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setMessages([]);
    setError(null);
    setDataDate(null);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!open) {
    // Pemicu inline, bukan tombol mengambang: FAB selalu melayang di atas konten
    // dan menutupi kontrol di baris terakhir tabel. Di sini ia punya tempat sendiri.
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm text-muted-foreground transition-colors duration-[var(--dur-micro)] hover:bg-accent hover:text-foreground print:hidden"
      >
        <MessageCircle aria-hidden className="size-4 shrink-0" />
        <span>AI Assistant</span>
      </button>
    );
  }

  // Panel di-portal ke <body>. Pemicunya hidup di dalam sidebar, dan sidebar
  // itu `position: sticky` — yang SELALU membuat stacking context. Kalau panel
  // ikut dirender di sana, `z-50`-nya hanya berlaku di dalam sidebar, sehingga
  // sel tabel (yang `relative` demi rail status) menimpanya dan panel tampak tembus.
  return createPortal(
    <div className="print:hidden fixed right-6 bottom-6 z-50 flex h-[min(500px,calc(100dvh-6rem))] w-[calc(100%-2rem)] max-w-96 flex-col rounded-card border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-base font-semibold">AI Assistant</h3>
          {dataDate && (
            <p className="text-xs text-muted-foreground">
              Data per {new Date(dataDate).toLocaleDateString("id-ID")}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
              Reset
            </Button>
          )}
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Tutup chat">
            <X aria-hidden className="size-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="mt-6 space-y-2 text-sm text-muted-foreground">
            <p>Tanyakan apa saja tentang data KPI dan timeline.</p>
            <p>
              Contoh: &ldquo;KPI mana yang paling buruk?&rdquo;
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm ${
              msg.role === "user"
                ? "ml-8 rounded-md bg-secondary px-3 py-2 text-foreground"
                : "mr-8 rounded-md border px-3 py-2 text-foreground"
            }`}
          >
            {msg.content}
          </div>
        ))}

        {loading && (
          <div className="mr-8 rounded-md border px-3 py-2">
            <LoadingSpinner />
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ketik pertanyaan..."
            disabled={loading}
            className="text-sm"
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSend}
            disabled={loading || !input.trim()}
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {messages.length}/20 pesan
        </p>
      </div>
    </div>,
    document.body
  );
}
