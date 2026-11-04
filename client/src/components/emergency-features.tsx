import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Heart, 
  Battery, 
  Wifi, 
  Users, 
  Clock,
  MapPin,
  Phone,
  MessageSquare,
  AlertTriangle,
  Shield,
  Activity,
  Bluetooth,
  Signal,
  Zap
} from "lucide-react";
import { bluetoothService, type DiscoveredNode } from "@/lib/bluetooth-service";
import { networkSimulation } from "@/lib/network-simulation";

interface EmergencyFeaturesProps {
  emergencyMode: boolean;
  connectedNodes: number;
  batteryLevel?: number;
  signalStrength?: number;
}

export function EmergencyFeatures({ 
  emergencyMode, 
  connectedNodes, 
  batteryLevel = 85,
  signalStrength = 75 
}: EmergencyFeaturesProps) {
  const [lastSeen, setLastSeen] = useState<Date>(new Date());
  const [bleDevices, setBleDevices] = useState<DiscoveredNode[]>([]);
  const [networkEvents, setNetworkEvents] = useState<any[]>([]);

  useEffect(() => {
    // Subscribe to BLE devices
    const bleUnsubscribe = bluetoothService.subscribe((devices) => {
      setBleDevices(devices);
    });

    // Subscribe to network events
    const networkUnsubscribe = networkSimulation.subscribeToEvents((event) => {
      setNetworkEvents(prev => [...prev.slice(-4), event]); // Keep last 5 events
    });

    // Update last seen time
    const timeInterval = setInterval(() => {
      setLastSeen(new Date());
    }, 1000);

    return () => {
      bleUnsubscribe();
      networkUnsubscribe();
      clearInterval(timeInterval);
    };
  }, []);

  const getNetworkHealth = () => {
    if (connectedNodes >= 8) return { status: "Excellent", color: "text-green-600", progress: 90 };
    if (connectedNodes >= 6) return { status: "Good", color: "text-blue-600", progress: 70 };
    if (connectedNodes >= 4) return { status: "Fair", color: "text-yellow-600", progress: 50 };
    return { status: "Critical", color: "text-red-600", progress: 30 };
  };

  const getConnectedBLEDevices = () => {
    return bleDevices.filter(device => device.rssi > -70);
  };

  const getEmergencyBLEDevices = () => {
    return bleDevices.filter(device => 
      device.emergencyStatus === 'critical' || device.emergencyStatus === 'warning'
    );
  };

  const getLatestNetworkEvent = () => {
    return networkEvents[networkEvents.length - 1];
  };

  const networkHealth = getNetworkHealth();
  const connectedBLEDevices = getConnectedBLEDevices();
  const emergencyBLEDevices = getEmergencyBLEDevices();
  const latestEvent = getLatestNetworkEvent();

  return (
    <div className="space-y-4">
      {/* Emergency Status Card */}
      <Card className={`${emergencyMode ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
        <CardHeader className="pb-2">
          <CardTitle className={`text-sm flex items-center ${emergencyMode ? 'text-red-700' : 'text-gray-700'}`}>
            {emergencyMode ? (
              <>
                <AlertTriangle className="h-4 w-4 mr-2 animate-pulse" />
                Emergency Status
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                System Status
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Network Health */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span>Network Health</span>
              <span className={networkHealth.color}>{networkHealth.status}</span>
            </div>
            <Progress value={networkHealth.progress} className="h-2" />
            <div className="text-xs text-gray-500">
              {connectedNodes}/12 nodes active
            </div>
          </div>

          {/* Device Status */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center space-x-1">
              <Battery className={`h-3 w-3 ${batteryLevel > 20 ? 'text-green-600' : 'text-red-600'}`} />
              <span>Battery: {batteryLevel}%</span>
            </div>
            <div className="flex items-center space-x-1">
              <Wifi className={`h-3 w-3 ${signalStrength > 50 ? 'text-green-600' : 'text-yellow-600'}`} />
              <span>Signal: {signalStrength}%</span>
            </div>
          </div>

          {/* BLE Device Status */}
          {bleDevices.length > 0 && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center space-x-1">
                <Bluetooth className="h-3 w-3 text-blue-600" />
                <span>BLE: {connectedBLEDevices.length} devices</span>
              </div>
              <div className="flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3 text-red-600" />
                <span>Alerts: {emergencyBLEDevices.length}</span>
              </div>
            </div>
          )}

          {/* Emergency Info */}
          {emergencyMode && (
            <div className="bg-red-100 p-2 rounded text-xs space-y-1">
              <div className="flex items-center text-red-700">
                <Heart className="h-3 w-3 mr-1" />
                <span className="font-semibold">Emergency Protocol Active</span>
              </div>
              <div className="text-red-600">
                • Priority message routing enabled
              </div>
              <div className="text-red-600">
                • Broadcasting location every 30 seconds
              </div>
              <div className="text-red-600">
                • Power conservation mode activated
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Network Events */}
      {latestEvent && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center text-purple-700">
              <Activity className="h-4 w-4 mr-2" />
              Latest Network Event
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span>Event Type:</span>
              <Badge variant="outline" className="text-xs">
                {latestEvent.type.replace('_', ' ')}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span>Node:</span>
              <span className="text-blue-600">{latestEvent.nodeId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Time:</span>
              <span className="text-gray-500">
                {new Date(latestEvent.timestamp).toLocaleTimeString()}
              </span>
            </div>
            {latestEvent.data && (
              <div className="text-xs text-gray-600">
                {JSON.stringify(latestEvent.data, null, 2)}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center text-blue-700">
            <MessageSquare className="h-4 w-4 mr-2" />
            Quick Actions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            <Button size="sm" variant="outline" className="justify-start text-xs">
              <Users className="h-3 w-3 mr-2" />
              Find Nearby Helpers
            </Button>
            <Button size="sm" variant="outline" className="justify-start text-xs">
              <MapPin className="h-3 w-3 mr-2" />
              Share Location
            </Button>
            <Button size="sm" variant="outline" className="justify-start text-xs">
              <Phone className="h-3 w-3 mr-2" />
              Emergency Contacts
            </Button>
            <Button size="sm" variant="outline" className="justify-start text-xs">
              <Bluetooth className="h-3 w-3 mr-2" />
              Scan BLE Devices
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network Statistics */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center text-purple-700">
            <Activity className="h-4 w-4 mr-2" />
            Network Stats
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          <div className="flex justify-between">
            <span>Active Connections:</span>
            <Badge variant="outline">{connectedNodes}</Badge>
          </div>
          <div className="flex justify-between">
            <span>Coverage Area:</span>
            <span className="text-blue-600">1.8km radius</span>
          </div>
          <div className="flex justify-between">
            <span>BLE Devices:</span>
            <span className="text-green-600">{bleDevices.length}</span>
          </div>
          <div className="flex justify-between">
            <span>Emergency Mode:</span>
            <Badge variant={emergencyMode ? "destructive" : "secondary"}>
              {emergencyMode ? "Active" : "Inactive"}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span>Last Update:</span>
            <span className="text-gray-500">
              <Clock className="h-3 w-3 inline mr-1" />
              {lastSeen.toLocaleTimeString()}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* BLE Device List */}
      {bleDevices.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center text-blue-700">
              <Bluetooth className="h-4 w-4 mr-2" />
              BLE Devices ({bleDevices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {bleDevices.slice(0, 3).map((device) => (
              <div key={device.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <Signal className={`h-3 w-3 ${device.rssi > -50 ? 'text-green-600' : device.rssi > -70 ? 'text-yellow-600' : 'text-red-600'}`} />
                  <div>
                    <div className="text-xs font-medium">{device.name}</div>
                    <div className="text-xs text-gray-500">{device.deviceType}</div>
                  </div>
                </div>
                <div className="flex items-center space-x-1">
                  {device.emergencyStatus && device.emergencyStatus !== 'normal' && (
                    <Badge variant="destructive" className="text-xs">
                      {device.emergencyStatus}
                    </Badge>
                  )}
                  <span className="text-xs text-gray-500">{device.rssi} dBm</span>
                </div>
              </div>
            ))}
            {bleDevices.length > 3 && (
              <div className="text-xs text-gray-500 text-center">
                +{bleDevices.length - 3} more devices
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}