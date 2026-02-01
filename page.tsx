"use client";

import React, { useState, useRef } from "react";
import { Send, Paperclip, FileText, Bot, User as UserIcon, LogOut, Loader2, Database } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import GithubConnect from "@/components/GithubConnect";
import { useAuth } from "@/components/AuthProvider";

export default function ChatPage() {
  const { user, logout } = useAuth();
  const [messages, setMessages] = useState<any[]>([{ id: "1", role: "assistant", content: "Hello! Upload docs or connect GitHub." }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkInputRef = useRef<HTMLInputElement>(null);

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now().toString(), role: "user", content: input };
    setMessages(p => [...p, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.content, store_name: "all" })
      });
      const data = await res.json();
      setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: data.answer }]);
    } catch {
      setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: "Error connecting to AI." }]);
    } finally { setIsLoading(false); }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setFiles(p => [...p, { name: file.name, status: "uploading" }]);
    const fd = new FormData(); fd.append("file", file);
    await fetch("/api/upload", { method: "POST", body: fd });
    setFiles(p => p.map(f => f.name === file.name ? { ...f, status: "done" } : f));
  };

  const handleBulkUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = "";
    setIsBulkProcessing(true);
    setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: `🔄 Processing Bulk File: ${file.name}...` }]);

    const fd = new FormData(); fd.append("file", file);
    const res = await fetch("/api/bulk-qa", { method: "POST", body: fd });

    if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `Processed_${file.name}`;
        document.body.appendChild(a); a.click();
        setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: `✅ Bulk processing complete. Downloading file...` }]);
    } else {
        setMessages(p => [...p, { id: Date.now().toString(), role: "assistant", content: `❌ Bulk processing failed.` }]);
    }
    setIsBulkProcessing(false);
  };

  return (
    <div className="flex h-screen bg-white text-gray-900">
      <div className="w-72 border-r bg-gray-50 flex flex-col">
        <div className="p-4 border-b font-bold flex gap-2"><Database className="w-5 h-5 text-blue-600"/> Knowledge Base</div>
        <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Integrations</h3>
                <GithubConnect />
            </section>
            <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Tools</h3>
                <input type="file" ref={bulkInputRef} onChange={handleBulkUpload} className="hidden" accept=".xlsx,.docx" />
                <button onClick={() => bulkInputRef.current?.click()} disabled={isBulkProcessing} className="w-full flex items-center gap-2 p-2 bg-indigo-50 text-indigo-700 rounded border border-indigo-100 text-xs">
                    {isBulkProcessing ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileText className="w-4 h-4"/>}
                    Bulk Q&A Processor
                </button>
            </section>
            <section>
                <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Documents</h3>
                {files.map((f, i) => <div key={i} className="text-xs p-2 bg-white border rounded mb-1">{f.name} ({f.status})</div>)}
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                <button onClick={() => fileInputRef.current?.click()} className="w-full text-xs p-2 border rounded mt-2 bg-white">Upload Doc</button>
            </section>
        </div>
        <div className="p-4 border-t bg-gray-100">
            <div className="font-bold text-sm mb-2">{user?.username}</div>
            <button onClick={logout} className="flex items-center gap-2 text-red-600 text-xs"><LogOut className="w-3 h-3"/> Sign Out</button>
        </div>
      </div>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 p-8 overflow-y-auto space-y-4">
            {messages.map((m) => (
                <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
                    <div className={`p-4 rounded-lg max-w-[80%] ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100'}`}>
                        <MarkdownRenderer content={m.content} />
                    </div>
                </div>
            ))}
            {isLoading && <div className="text-gray-400 text-sm animate-pulse ml-12">Thinking...</div>}
        </div>
        <div className="p-4 border-t">
            <div className="flex gap-2 max-w-3xl mx-auto">
                <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleSendMessage()} className="flex-1 p-3 bg-gray-100 rounded-full outline-none" placeholder="Ask question..." />
                <button onClick={handleSendMessage} className="p-3 bg-blue-600 text-white rounded-full"><Send className="w-5 h-5"/></button>
            </div>
        </div>
      </div>
    </div>
  );
}