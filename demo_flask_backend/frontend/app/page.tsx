"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, Paperclip, FileText, Bot, User as UserIcon, LogOut, Loader2, Database } from "lucide-react";
import MarkdownRenderer from "@/components/MarkdownRenderer";
import GithubConnect from "@/components/GithubConnect";
import { useAuth } from "@/components/AuthProvider";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  name: string;
  status: "uploading" | "done" | "error";
}

export default function ChatPage() {
  const { user, logout } = useAuth(); // Hooks into the Auth Context
  const [messages, setMessages] = useState<Message[]>([{
    id: "1", role: "assistant", content: "Hello! I'm ready to search your **documents** and **GitHub repos**."
  }]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];

    setFiles(prev => [...prev, { name: file.name, status: "uploading" }]);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: res.ok ? "done" : "error" } : f));
    } catch {
      setFiles(prev => prev.map(f => f.name === file.name ? { ...f, status: "error" } : f));
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMsg.content, store_name: "all" }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: data.answer }]);
    } catch {
      setMessages(prev => [...prev, { id: Date.now().toString(), role: "assistant", content: "⚠️ Network Error" }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">

      {/* Sidebar */}
      <div className="w-72 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-bold text-lg flex items-center gap-2"><Database className="w-5 h-5 text-blue-600" /> Knowledge Base</h2>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <section>
             <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Integrations</h3>
             <GithubConnect />
          </section>

          <section>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Documents</h3>
            <div className="space-y-2 mb-3">
              {files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 shadow-sm text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-3 h-3 text-gray-500" />
                    <span className="truncate max-w-[120px]">{file.name}</span>
                  </div>
                  {file.status === "uploading" && <Loader2 className="w-3 h-3 animate-spin text-blue-500" />}
                  {file.status === "done" && <span className="text-green-500 font-bold">READY</span>}
                  {file.status === "error" && <span className="text-red-500 font-bold">ERR</span>}
                </div>
              ))}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.docx,.txt" />
            <button onClick={() => fileInputRef.current?.click()} className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border hover:bg-gray-100 py-2 rounded-md text-xs font-medium transition-colors">
              <Paperclip className="w-3 h-3" /> Upload Document
            </button>
          </section>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900">
          <div className="flex items-center gap-3 mb-3">
             <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold">{user?.username.charAt(0).toUpperCase()}</div>
             <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.username}</p>
                <p className="text-xs text-green-600 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Online</p>
             </div>
          </div>
          <button onClick={logout} className="w-full flex items-center justify-center gap-2 text-red-600 hover:bg-red-50 py-2 rounded text-xs font-medium transition-colors">
            <LogOut className="w-3 h-3" /> Sign Out
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full relative">
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-4 max-w-3xl mx-auto ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mt-1"><Bot className="w-5 h-5 text-indigo-600" /></div>}
              <div className={`flex-1 max-w-[85%] px-5 py-4 rounded-2xl shadow-sm ${msg.role === "user" ? "bg-blue-600 text-white rounded-br-none" : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-bl-none"}`}>
                {msg.role === "user" ? <p className="whitespace-pre-wrap">{msg.content}</p> : <MarkdownRenderer content={msg.content} />}
              </div>
              {msg.role === "user" && <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center mt-1"><UserIcon className="w-5 h-5 text-gray-500" /></div>}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-4 max-w-3xl mx-auto animate-pulse">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center"><Bot className="w-5 h-5 text-indigo-600" /></div>
              <div className="text-gray-400 text-sm py-2">Searching knowledge base...</div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="max-w-3xl mx-auto relative flex items-center gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} placeholder="Ask about your docs or repos..." disabled={isLoading} className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 focus:ring-2 focus:ring-blue-500 rounded-full px-5 py-3 shadow-inner outline-none" />
            <button onClick={handleSendMessage} disabled={isLoading || !input.trim()} className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg transition-transform active:scale-95"><Send className="w-5 h-5" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}