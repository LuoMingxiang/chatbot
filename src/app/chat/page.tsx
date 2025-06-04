// app/chat/page.tsx
"use client"

import { useState } from "react"

export default function ChatPage() {
    const [input, setInput] = useState("")
    const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([])

    async function handleSend() {
        if (!input.trim()) return

        // 用户消息先加进去
        const newMessages = [...messages, { role: "user", content: input }]
        setMessages(newMessages)
        setInput("")

        // 调用 OpenAI 接口 (非流式)
        try {
            const res = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ messages: newMessages }),
            })
            const data = await res.json()
            if (data?.answer) {
                setMessages([...newMessages, { role: "assistant", content: data.answer }])
            } else {
                setMessages([...newMessages, { role: "assistant", content: "机器人无响应" }])
            }
        } catch (error) {
            setMessages([...newMessages, { role: "assistant", content: "请求失败，请稍后重试" }])
        }
    }

    return (
        <div className="flex flex-col h-screen max-w-3xl mx-auto p-4">
            <div className="flex-1 overflow-y-auto mb-4 space-y-3 border rounded p-3 bg-gray-50">
                {messages.map((msg, i) => (
                    <div
                        key={i}
                        className={`p-2 rounded ${msg.role === "user" ? "bg-blue-100 text-right" : "bg-green-100 text-left"
                            }`}
                    >
                        {msg.content}
                    </div>
                ))}
            </div>

            <div className="flex gap-2">
                <input
                    type="text"
                    className="flex-1 border rounded px-3 py-2"
                    placeholder="请输入消息..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                    className="bg-blue-600 text-white px-4 rounded disabled:bg-blue-300"
                    onClick={handleSend}
                    disabled={!input.trim()}
                >
                    发送
                </button>
            </div>
        </div>
    )
}
