"use client";

import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Paperclip, FileText, Bot, User, Trash2, Loader2 } from "lucide-react";

// --- TYPES ---
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface UploadedFile {
  name: string;
  size: string;
  type: string;
}

// --- COMPONENTS ---

// 1. The Markdown Renderer (Handles the AI response formatting)
const MarkdownRenderer = ({ content }: { content: string }) => {
  return (
    <div className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-pre:bg-gray-100 dark:prose-pre:bg-gray-800 rounded-lg">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
};

// 2. Main Page Component
export default function KnowledgeBaseChat() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: "Hello! I'm your Knowledge Assistant. Upload a document or ask me anything about your project.",
    },
  ]);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  // Auto-scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // --- HANDLERS ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Mock adding file to UI (In real app, upload to your Python backend here)
      const newFile: UploadedFile = {
        name: file.name,
        size: (file.size / 1024).toFixed(1) + " KB",
        type: file.type.includes("pdf") ? "pdf" : "doc",
      };

      setFiles((prev) => [...prev, newFile]);

      // Optional: Send file to backend
      // const formData = new FormData();
      // formData.append('file', file);
      // fetch('http://localhost:8000/upload', { method: 'POST', body: formData });
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Connect to your Python RAG Backend
      const response = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage.content }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "Sorry, I couldn't process that.", // Adjust based on your Python return key
      };

      setMessages((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error talking to backend:", error);
      // Fallback for UI testing if backend is offline
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "⚠️ **Error:** Could not connect to the backend. Make sure your Python server is running on port 8000.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans">

      {/* --- SIDEBAR (Files) --- */}
      <div className="w-64 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col hidden md:flex">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Knowledge Base
          </h2>
          <p className="text-xs text-gray-500 mt-1">Python RAG System</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Indexed Files</h3>
            {files.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No files uploaded yet.</p>
            ) : (
              files.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-md shadow-sm border border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 truncate">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center text-blue-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{file.name}</p>
                      <p className="text-xs text-gray-500">{file.size}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            className="hidden"
            accept=".pdf,.docx,.xlsx"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm font-medium py-2 px-4 rounded-md transition-colors"
          >
            <Paperclip className="w-4 h-4" />
            Upload Document
          </button>
        </div>
      </div>

      {/* --- MAIN CHAT AREA --- */}
      <div className="flex-1 flex flex-col h-full relative">

        {/* Header */}
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between px-6 bg-white dark:bg-gray-950/80 backdrop-blur-md z-10">
          <h1 className="font-semibold text-gray-800 dark:text-white">Chat Assistant</h1>
          <div className="text-xs text-gray-400">Model: GPT-4o-mini</div>
        </header>

        {/* Messages List */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 max-w-3xl mx-auto ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              {/* Avatar for Assistant */}
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
              )}

              {/* Message Bubble */}
              <div
                className={`flex-1 max-w-[85%] px-4 py-3 rounded-2xl shadow-sm ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-bl-none"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                ) : (
                  <MarkdownRenderer content={msg.content} />
                )}
              </div>

              {/* Avatar for User */}
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-5 h-5 text-gray-500 dark:text-gray-300" />
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-4 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center mt-1">
                <Bot className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-sm p-3">
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
          <div className="max-w-3xl mx-auto relative flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
              placeholder="Ask about your documents..."
              className="flex-1 bg-gray-100 dark:bg-gray-900 border-0 focus:ring-2 focus:ring-blue-500 rounded-full px-5 py-3 text-gray-900 dark:text-gray-100 placeholder-gray-500 shadow-inner"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !input.trim()}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full shadow-lg transition-transform active:scale-95 flex items-center justify-center"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">
            AI can make mistakes. Check your documents.
          </p>
        </div>

      </div>
    </div>
  );
}