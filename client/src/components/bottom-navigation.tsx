import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Map, MessageCircle, Settings } from "lucide-react";

interface BottomNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unreadCount: number;
}

export function BottomNavigation({ activeTab, onTabChange, unreadCount }: BottomNavigationProps) {
  const tabs = [
    { id: "home", label: "Home", icon: Home, path: "/app" },
    { id: "maps", label: "Maps", icon: Map, path: "/maps" },
    { id: "messages", label: "Messages", icon: MessageCircle, path: "/messages" },
    { id: "settings", label: "Settings", icon: Settings, path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-2 safe-area-pb">
      <div className="flex items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <Button
              key={tab.id}
              variant="ghost"
              onClick={() => onTabChange(tab.path)}
              className={`flex flex-col items-center py-1 px-3 h-auto ${
                isActive 
                  ? "text-blue-600" 
                  : "text-gray-600 hover:text-gray-800"
              }`}
            >
              <div className="relative">
                <Icon className="h-6 w-6 mb-1" />
                {tab.id === "messages" && unreadCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-xs"
                  >
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <span className="text-xs font-medium">{tab.label}</span>
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
