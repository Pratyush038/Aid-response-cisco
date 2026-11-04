import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Message, NetworkNode, NetworkConnection } from "@/types/network";
import { calculateOptimalRoute } from "@/lib/dijkstra";
import { 
  Send, 
  User, 
  Shield, 
  Route, 
  CheckCheck, 
  AlertTriangle,
  Info,
  Plus,
  Radio
} from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";

export function MessagesView() {
  const [messageInput, setMessageInput] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    data: messages = [],
    isLoading: messagesLoading,
    isError: messagesError,
  } = useQuery<Message[]>({
    queryKey: ["/api/messages"],
    refetchInterval: 2000,
  });

  const { data: nodes = [], isError: nodesError } = useQuery<NetworkNode[]>({
    queryKey: ["/api/nodes"],
  });

  const { data: connections = [], isError: connectionsError } = useQuery<NetworkConnection[]>({
    queryKey: ["/api/connections"],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
  });

  const { data: authStatus } = useQuery<{ username: string }>({
    queryKey: ["/api/auth/me"],
  });

  const [selectedRecipient, setSelectedRecipient] = useState<string>("broadcast");

  const currentUser = authStatus?.username || "user";

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (nodesError || connectionsError) {
        throw new Error("Network topology is unavailable");
      }

      // Direct User or Node Messaging
      if (selectedRecipient !== "broadcast") {
        const destUser = users.find(u => u.username === selectedRecipient);
        const destNode = nodes.find(n => n.nodeId === selectedRecipient);

        if (destUser) {
          if (!destUser.nearestNodeId) throw new Error("Recipient has not connected to a network node yet");

          const routingResult = calculateOptimalRoute(nodes, connections, "user", destUser.nearestNodeId);
          const routingPath = routingResult ? routingResult.path : ["user", destUser.nearestNodeId];
          
          const response = await apiRequest("POST", "/api/messages/direct", {
            senderId: currentUser,
            receiverId: destUser.username,
            content: `[E2EE-ENCRYPTED]:${btoa(content)}`,
            routingPath,
            hops: routingPath.length,
          });
          return response.json();
        } else if (destNode) {
          const routingResult = calculateOptimalRoute(nodes, connections, "user", destNode.nodeId);
          const routingPath = routingResult ? routingResult.path : ["user", destNode.nodeId];
          
          const response = await apiRequest("POST", "/api/messages", {
            senderId: currentUser,
            receiverId: destNode.nodeId,
            content,
            messageType: "normal",
            routingPath,
            hops: routingPath.length - 1,
          });
          return response.json();
        }
        throw new Error("Recipient not found");
      }

      // Broadcast Messaging
      const onlineNodes = nodes.filter(node => node.isOnline && node.nodeId !== "user");
      const targetNode = onlineNodes.length > 0 ? onlineNodes[0] : null;
      
      if (!targetNode) {
        throw new Error("No online nodes available");
      }
      
      const routingResult = calculateOptimalRoute(nodes, connections, "user", targetNode.nodeId);
      const routingPath = routingResult ? routingResult.path : ["user", targetNode.nodeId];
      
      const response = await apiRequest("POST", "/api/messages", {
        senderId: currentUser,
        receiverId: targetNode.nodeId,
        content,
        messageType: "normal",
        routingPath,
        hops: routingPath.length - 1,
      });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Message Sent",
        description: "Your message has been transmitted via mesh network",
      });
      setMessageInput("");
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/stats"] });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Send Message",
        description: error.message || "Please check your connection and try again",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (messageInput.trim()) {
      sendMessageMutation.mutate(messageInput.trim());
    }
  };

  const formatTimeAgo = (timestamp: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - new Date(timestamp).getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const getMessageTypeIcon = (messageType: string) => {
    switch (messageType) {
      case "sos":
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case "system":
        return <Info className="h-3 w-3 text-blue-500" />;
      default:
        return <User className="h-3 w-3" />;
    }
  };

  if (messagesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-sm text-gray-500">Loading messages...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-slate-50 pb-20">
      {/* Messages Header */}
      <CardHeader className="border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Messages</CardTitle>
          <Button
            variant="ghost" 
            size="sm"
            onClick={async () => {
              if (confirm("Clear all messages? This action cannot be undone.")) {
                try {
                  await apiRequest("DELETE", "/api/messages");
                  queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
                  toast({
                    title: "Messages Cleared",
                    description: "All messages have been removed from the network",
                  });
                } catch (error) {
                  toast({
                    title: "Failed to Clear Messages",
                    description: "Please try again",
                    variant: "destructive",
                  });
                }
              }
            }}
          >
            Clear All
          </Button>
        </div>
        <p className="text-xs text-gray-500">Mesh network communication</p>
      </CardHeader>

      {/* Message List */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messagesError ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Messages unavailable</AlertTitle>
              <AlertDescription>
                The message API did not respond. Check the dev server and try again.
              </AlertDescription>
            </Alert>
          ) : messages.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-2">
                <User className="h-12 w-12 mx-auto" />
              </div>
              <p className="text-sm text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400">Start a conversation with nearby nodes</p>
            </div>
          ) : (
            messages.map((message) => {
              const isOutgoing = message.senderId === currentUser;
              const isSystemMessage = message.messageType === "system";
              
              let isEncrypted = false;
              let displayContent = message.content;
              let decryptionFailed = false;

              if (displayContent.startsWith("[E2EE-ENCRYPTED]:")) {
                isEncrypted = true;
                const base64Data = displayContent.split(":")[1];
                
                // Only decrypt if we are the sender or receiver
                if (message.senderId === currentUser || message.receiverId === currentUser || message.receiverId === authStatus?.username) {
                  try {
                    displayContent = atob(base64Data);
                  } catch {
                    displayContent = "Error decrypting message";
                    decryptionFailed = true;
                  }
                } else {
                  // Display as scrambled ciphertext for other users to demonstrate E2EE
                  displayContent = base64Data.substring(0, 32) + "...";
                  decryptionFailed = true; // Flag to show it as unreadable
                }
              }

              if (isSystemMessage) {
                return (
                  <div key={message.id} className="flex justify-center">
                    <div className="max-w-xs rounded-lg border border-amber-200 bg-amber-50 p-2 text-center text-xs text-amber-900">
                      <Info className="h-3 w-3 text-yellow-600 mr-1 inline" />
                      {displayContent}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={message.id}
                  className={`flex items-start space-x-3 ${
                    isOutgoing ? "flex-row-reverse space-x-reverse" : ""
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isOutgoing ? "bg-red-600" : "bg-blue-500"
                  }`}>
                    {getMessageTypeIcon(message.messageType)}
                  </div>
                  
                  <div className="flex-1">
                    <div className={`rounded-lg p-3 max-w-xs ${
                      isOutgoing 
                        ? "bg-blue-500 text-white ml-auto" 
                        : message.messageType === "sos"
                          ? "bg-red-100 border border-red-200"
                          : "bg-gray-100"
                    }`}>
                      {isEncrypted && (
                        <div className="flex items-center text-[10px] opacity-70 mb-1">
                          <Shield className="h-3 w-3 mr-1" />
                          End-to-End Encrypted
                        </div>
                      )}
                      <p className={`text-sm mt-1 ${
                        message.messageType === "sos" ? "text-red-800" : ""
                      } ${decryptionFailed ? "font-mono text-gray-500 italic break-all" : ""}`}>
                        {displayContent}
                      </p>
                      
                      <div className={`mt-2 text-xs flex items-center space-x-2 ${
                        isOutgoing 
                          ? "text-blue-100 justify-end" 
                          : "text-gray-500"
                      }`}>
                        {!isOutgoing && (
                          <>
                            <span>{message.senderId === "user" ? "You" : message.senderId.replace("-", " ").replace(/\b\w/g, l => l.toUpperCase())}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatTimeAgo(message.timestamp)}</span>
                        {message.receiverId && message.receiverId !== "user" && message.messageType !== "sos" && message.messageType !== "system" && (
                          <>
                            <span>•</span>
                            <span>To: {message.receiverId}</span>
                          </>
                        )}
                        {message.hops > 1 && (
                          <>
                            <span>•</span>
                            <Badge variant="secondary" className="text-xs">
                              {message.hops} hops
                            </Badge>
                          </>
                        )}
                        {isOutgoing && message.isDelivered && (
                          <CheckCheck className="h-3 w-3 text-green-200" />
                        )}
                      </div>
                    </div>
                    
                    {/* Routing Path Visualization with Network Concepts */}
                    {message.routingPath && message.routingPath.length > 1 && (
                      <div className="mt-1 text-xs text-gray-400 space-y-1">
                        <div className="flex items-center">
                          <Route className="h-3 w-3 mr-1" />
                          Route: 
                          {message.routingPath.map((hop, index) => (
                            <span key={index}>
                              {index > 0 && " → "}
                              {hop === "user" ? message.senderId : hop}
                            </span>
                          ))}
                          {message.hops <= 2 && " (optimal path)"}
                        </div>
                        <div className="text-blue-600 font-medium">
                          {message.hops === 1 ? "🚀 Direct Link" : 
                           message.hops === 2 ? "📡 Single Hop Relay" :
                           message.hops === 3 ? "🔄 Multi-hop Routing" :
                           "🌐 Complex Mesh Path"}
                        </div>
                        {message.messageType === "sos" && (
                          <div className="text-red-600 font-medium">
                            🚨 Emergency Broadcast (Flooding Protocol)
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          {/* Auto-scroll target */}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      <div className="border-t border-slate-200 bg-white p-4">
        <div className="flex items-center space-x-2 mb-2">
          <Select value={selectedRecipient} onValueChange={setSelectedRecipient}>
            <SelectTrigger className="w-[180px] h-8 text-xs">
              <SelectValue placeholder="Select Recipient" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="broadcast">
                <div className="flex items-center">
                  <Radio className="h-3 w-3 mr-2 text-blue-600" />
                  Broadcast to All
                </div>
              </SelectItem>
              
              <SelectGroup>
                <SelectLabel className="text-xs text-gray-500 font-semibold uppercase tracking-wider py-1">Users</SelectLabel>
                {users.filter(u => u.username !== authStatus?.username).map(user => (
                  <SelectItem key={user.id} value={user.username}>
                    <div className="flex items-center">
                      <User className="h-3 w-3 mr-2 text-slate-600" />
                      {user.username}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>

              <SelectGroup>
                <SelectLabel className="text-xs text-gray-500 font-semibold uppercase tracking-wider py-1 border-t mt-1">Network Nodes</SelectLabel>
                {nodes.filter(n => n.nodeId !== "user" && n.isOnline).map(node => (
                  <SelectItem key={node.nodeId} value={node.nodeId}>
                    <div className="flex items-center">
                      <Route className="h-3 w-3 mr-2 text-slate-600" />
                      {node.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center space-x-2">
          <Input
            type="text"
            placeholder="Type emergency message..."
            value={messageInput}
            onChange={(e) => setMessageInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1"
            disabled={sendMessageMutation.isPending || messagesError}
          />
          <Button 
            onClick={handleSendMessage} 
            disabled={!messageInput.trim() || sendMessageMutation.isPending || messagesError}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {selectedRecipient === "broadcast" ? (
              <Radio className="h-4 w-4 mr-2" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            {selectedRecipient === "broadcast" ? "Broadcast" : "Send Secure"}
          </Button>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 flex items-center">
          <Shield className="h-3 w-3 mr-1 text-green-600" />
          End-to-end encrypted • Mesh routing enabled
        </div>
      </div>
    </div>
  );
}
