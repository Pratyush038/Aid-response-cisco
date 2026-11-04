import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function Chatbot() {
  const SUGGESTED_QUESTIONS = [
    "How does Dijkstra routing work here?",
    "What happens if a node goes offline?",
    "How are SOS alerts handled?"
  ];

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the Aid-Response Crisis AI. How can I assist you with the disaster network simulator today?" }
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (text?: string) => {
    const messageContent = text || input;
    if (!messageContent.trim()) return;

    const newMessages = [...messages, { role: "user" as const, content: messageContent }];
    setMessages(newMessages);
    if (!text) setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages })
      });

      if (!res.ok) throw new Error("Failed to fetch from AI");

      const data = await res.json();
      setMessages([...newMessages, { role: "assistant", content: data.reply || "Sorry, I couldn't process that." }]);
    } catch (error) {
      console.error(error);
      setMessages([...newMessages, { role: "assistant", content: "⚠️ Error connecting to AI. Please check the backend." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <Button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-all"
          size="icon"
        >
          <MessageSquare className="h-6 w-6" />
        </Button>
      )}

      {isOpen && (
        <Card className="fixed bottom-6 right-6 w-80 sm:w-96 shadow-2xl z-50 flex flex-col h-[500px]">
          <CardHeader className="p-4 border-b flex flex-row items-center justify-between bg-primary text-primary-foreground rounded-t-xl">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <CardTitle className="text-sm font-medium">Crisis AI Assistant</CardTitle>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full hover:bg-primary/20 hover:text-white" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="flex-1 p-0 overflow-hidden">
            <ScrollArea className="h-full p-4" ref={scrollRef}>
              <div className="flex flex-col gap-3">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted max-w-[80%] rounded-lg px-3 py-2 text-sm flex gap-1">
                      <span className="animate-bounce">.</span><span className="animate-bounce delay-75">.</span><span className="animate-bounce delay-150">.</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>

          <CardFooter className="p-3 border-t flex flex-col gap-2">
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 mb-1">
                {SUGGESTED_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(q)}
                    className="text-[11px] bg-secondary hover:bg-secondary/80 text-secondary-foreground rounded-full px-3 py-1.5 transition-colors border text-left leading-tight"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex w-full gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about routing, nodes..."
                className="flex-1"
                disabled={isLoading}
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </CardFooter>
        </Card>
      )}
    </>
  );
}
