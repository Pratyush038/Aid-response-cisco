import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  Network, 
  Settings as SettingsIcon, 
  Phone,
  Shield,
  Zap,
  Route,
  Radio
} from "lucide-react";

export function SettingsView() {
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Settings Header */}
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg">Settings & Info</CardTitle>
        <p className="text-xs text-gray-500">Network configuration and help</p>
      </CardHeader>

      {/* Settings Content */}
      <div className="flex-1 overflow-y-auto">
        {/* How It Works Section */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <HelpCircle className="h-4 w-4 text-blue-500 mr-2" />
            How Aid-Response Works
          </h3>
          <div className="space-y-3 text-sm text-gray-600">
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3">
                <h4 className="font-medium text-blue-900 mb-1 flex items-center">
                  <Network className="h-4 w-4 mr-1" />
                  Mesh Networking
                </h4>
                <p className="text-xs">
                  Devices form a self-healing network where each node can relay messages, 
                  ensuring communication even when infrastructure fails.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-green-50 border-green-200">
              <CardContent className="p-3">
                <h4 className="font-medium text-green-900 mb-1 flex items-center">
                  <Route className="h-4 w-4 mr-1" />
                  Dijkstra's Algorithm
                </h4>
                <p className="text-xs">
                  Messages are routed through the most efficient path based on distance, 
                  signal strength, and node availability.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-purple-50 border-purple-200">
              <CardContent className="p-3">
                <h4 className="font-medium text-purple-900 mb-1 flex items-center">
                  <Zap className="h-4 w-4 mr-1" />
                  Emergency Broadcasting
                </h4>
                <p className="text-xs">
                  SOS messages use flood routing to reach all nodes simultaneously, 
                  maximizing rescue coordination.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Network Settings */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <SettingsIcon className="h-4 w-4 text-green-600 mr-2" />
            Network Configuration
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Auto-discovery</span>
                <p className="text-xs text-gray-500">Automatically find nearby nodes</p>
              </div>
              <Switch defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Low power mode</span>
                <p className="text-xs text-gray-500">Extend battery life</p>
              </div>
              <Switch />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">Emergency alerts</span>
                <p className="text-xs text-gray-500">Receive emergency broadcasts</p>
              </div>
              <Switch defaultChecked />
            </div>
          </div>
        </div>

        {/* Technical Details */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Radio className="h-4 w-4 text-gray-500 mr-2" />
            Technical Information
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Protocol:</span>
              <Badge variant="outline">LoRa Mesh</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Frequency:</span>
              <span className="font-medium">868 MHz</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Max Range:</span>
              <span className="font-medium">5 km</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Encryption:</span>
              <Badge variant="outline" className="text-green-700 border-green-300">
                <Shield className="h-3 w-3 mr-1" />
                AES-256
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Battery Life:</span>
              <Badge variant="outline" className="text-green-700 border-green-300">
                72 hours
              </Badge>
            </div>
          </div>
        </div>

        {/* Emergency Contacts */}
        <div className="p-4">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
            <Phone className="h-4 w-4 text-red-600 mr-2" />
            Emergency Contacts
          </h3>
          <div className="space-y-2">
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Emergency Services</p>
                  <p className="text-xs text-gray-500">Primary emergency line</p>
                </div>
                <Badge variant="destructive" className="font-bold">
                  108
                </Badge>
              </CardContent>
            </Card>
            
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">Disaster Management</p>
                  <p className="text-xs text-gray-500">NDRF coordination</p>
                </div>
                <Badge variant="outline" className="text-blue-600 border-blue-300 font-bold">
                  011-26701728
                </Badge>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* App Information */}
        <div className="p-4 border-t border-gray-100">
          <div className="text-center text-xs text-gray-500 space-y-1">
            <p className="font-medium">Aid-Response v1.0.0</p>
            <p>Disaster Relief Communication Network</p>
            <p>Built for emergency response scenarios</p>
          </div>
        </div>
      </div>
    </div>
  );
}
