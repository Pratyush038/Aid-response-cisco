import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Bluetooth, 
  BluetoothOff, 
  Signal, 
  Battery, 
  MapPin,
  AlertTriangle,
  Wifi,
  Users,
  Activity,
  Settings,
  RefreshCw,
  CheckCircle,
  XCircle,
  Zap,
  Shield
} from "lucide-react";
import { bluetoothService, type DiscoveredNode } from "@/lib/bluetooth-service";
import { useToast } from "@/hooks/use-toast";
import { formatRounded } from "@/lib/utils";

interface BluetoothManagerProps {
  className?: string;
}

export function BluetoothManager({ className }: BluetoothManagerProps) {
  const [discoveredDevices, setDiscoveredDevices] = useState<DiscoveredNode[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isBluetoothSupported, setIsBluetoothSupported] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ isConnected: boolean; deviceName?: string }>({ isConnected: false });
  const [selectedDevice, setSelectedDevice] = useState<DiscoveredNode | null>(null);
  const [showDeviceDetails, setShowDeviceDetails] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check Bluetooth support
    setIsBluetoothSupported(bluetoothService.isBluetoothSupported());
    
    // Subscribe to device discovery
    const unsubscribe = bluetoothService.subscribe((devices) => {
      setDiscoveredDevices(devices);
    });

    // Update connection status
    const updateConnectionStatus = () => {
      setConnectionStatus(bluetoothService.getConnectionStatus());
    };
    
    updateConnectionStatus();
    const statusInterval = setInterval(updateConnectionStatus, 2000);

    return () => {
      unsubscribe();
      clearInterval(statusInterval);
    };
  }, []);

  const handleStartScan = async () => {
    try {
      setIsScanning(true);
      await bluetoothService.startScanning();
      toast({
        title: "Bluetooth Scan Started",
        description: "Searching for nearby Aid-Response devices...",
      });
    } catch (error) {
      toast({
        title: "Scan Failed",
        description: "Unable to start Bluetooth scanning",
        variant: "destructive",
      });
    } finally {
      setIsScanning(false);
    }
  };

  const handleStopScan = () => {
    bluetoothService.stopScanning();
    setIsScanning(false);
    toast({
      title: "Scan Stopped",
      description: "Bluetooth scanning has been stopped",
    });
  };

  const handleConnectToDevice = async (device: DiscoveredNode) => {
    try {
      const success = await bluetoothService.connectToDevice(device.id);
      if (success) {
        toast({
          title: "Connected",
          description: `Successfully connected to ${device.name}`,
        });
        setConnectionStatus(bluetoothService.getConnectionStatus());
      } else {
        toast({
          title: "Connection Failed",
          description: `Failed to connect to ${device.name}`,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Connection Error",
        description: "An error occurred while connecting",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = () => {
    bluetoothService.disconnect();
    setConnectionStatus({ isConnected: false });
    toast({
      title: "Disconnected",
      description: "Bluetooth device disconnected",
    });
  };

  const getDeviceIcon = (deviceType: DiscoveredNode['deviceType']) => {
    switch (deviceType) {
      case 'smartphone':
        return <Signal className="h-4 w-4" />;
      case 'tablet':
        return <Activity className="h-4 w-4" />;
      case 'emergency_beacon':
        return <AlertTriangle className="h-4 w-4" />;
      case 'relay_station':
        return <Wifi className="h-4 w-4" />;
      case 'medical_device':
        return <Shield className="h-4 w-4" />;
      default:
        return <Bluetooth className="h-4 w-4" />;
    }
  };

  const getSignalStrengthColor = (rssi: number) => {
    if (rssi > -50) return "text-green-600";
    if (rssi > -70) return "text-yellow-600";
    return "text-red-600";
  };

  const getEmergencyStatusColor = (status?: DiscoveredNode['emergencyStatus']) => {
    switch (status) {
      case 'critical':
        return "text-red-600";
      case 'warning':
        return "text-yellow-600";
      default:
        return "text-green-600";
    }
  };

  return (
    <div className={className}>
      {/* Bluetooth Status Card */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center">
              <Bluetooth className={`h-5 w-5 mr-2 ${connectionStatus.isConnected ? 'text-blue-600' : 'text-gray-400'}`} />
              Bluetooth LE Network
            </div>
            <Badge variant={connectionStatus.isConnected ? "default" : "secondary"}>
              {connectionStatus.isConnected ? "Connected" : "Disconnected"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connection Status */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Status:</span>
            <div className="flex items-center space-x-2">
              {connectionStatus.isConnected ? (
                <>
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">
                    {connectionStatus.deviceName || "Connected"}
                  </span>
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 text-gray-400" />
                  <span className="text-sm text-gray-500">Not Connected</span>
                </>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            {!isScanning ? (
              <Button 
                onClick={handleStartScan} 
                size="sm" 
                className="flex-1"
                disabled={!isBluetoothSupported}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Scan for Devices
              </Button>
            ) : (
              <Button 
                onClick={handleStopScan} 
                size="sm" 
                variant="outline" 
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Stop Scan
              </Button>
            )}
            
            {connectionStatus.isConnected && (
              <Button 
                onClick={handleDisconnect} 
                size="sm" 
                variant="destructive"
              >
                <BluetoothOff className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            )}
          </div>

          {/* Bluetooth Support Status */}
          {!isBluetoothSupported && (
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="flex items-center text-yellow-800">
                <AlertTriangle className="h-4 w-4 mr-2" />
                <span className="text-sm">
                  Web Bluetooth API not supported. Using simulation mode.
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Discovered Devices */}
      {discoveredDevices.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center justify-between">
              <div className="flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Discovered Devices ({discoveredDevices.length})
              </div>
              {isScanning && (
                <div className="flex items-center text-blue-600">
                  <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                  <span className="text-sm">Scanning...</span>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {discoveredDevices.map((device) => (
              <div
                key={device.id}
                className="border rounded-lg p-3 hover:bg-gray-50 transition-colors cursor-pointer"
                onClick={() => {
                  setSelectedDevice(device);
                  setShowDeviceDetails(true);
                }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    {getDeviceIcon(device.deviceType)}
                    <div>
                      <div className="font-medium text-sm">{device.name}</div>
                      <div className="text-xs text-gray-500">{device.nodeId}</div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant="outline" className="text-xs">
                      {device.deviceType.replace('_', ' ')}
                    </Badge>
                    {device.emergencyStatus && device.emergencyStatus !== 'normal' && (
                      <Badge variant="destructive" className="text-xs">
                        {device.emergencyStatus}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex items-center space-x-1">
                    <Signal className={`h-3 w-3 ${getSignalStrengthColor(device.rssi)}`} />
                    <span>{formatRounded(device.rssi)} dBm</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-3 w-3 text-blue-600" />
                    <span>{formatRounded(device.distance)}m</span>
                  </div>
                  {device.batteryLevel && (
                    <div className="flex items-center space-x-1">
                      <Battery className="h-3 w-3 text-green-600" />
                      <span>{device.batteryLevel}%</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <Activity className="h-3 w-3 text-purple-600" />
                    <span>{device.capabilities.length} capabilities</span>
                  </div>
                </div>

                <div className="mt-2">
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConnectToDevice(device);
                    }}
                    className="w-full"
                    disabled={connectionStatus.isConnected}
                  >
                    <Bluetooth className="h-3 w-3 mr-1" />
                    Connect
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Device Details Dialog */}
      <Dialog open={showDeviceDetails} onOpenChange={setShowDeviceDetails}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              {selectedDevice && getDeviceIcon(selectedDevice.deviceType)}
              <span className="ml-2">Device Details</span>
            </DialogTitle>
          </DialogHeader>
          
          {selectedDevice && (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold">{selectedDevice.name}</h3>
                <p className="text-sm text-gray-500">{selectedDevice.nodeId}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Signal Strength:</span>
                  <div className="flex items-center space-x-1">
                    <Signal className={`h-4 w-4 ${getSignalStrengthColor(selectedDevice.rssi)}`} />
                    <span>{formatRounded(selectedDevice.rssi)} dBm</span>
                  </div>
                </div>
                
                <div>
                  <span className="text-gray-600">Distance:</span>
                  <div className="flex items-center space-x-1">
                    <MapPin className="h-4 w-4 text-blue-600" />
                    <span>{formatRounded(selectedDevice.distance)}m</span>
                  </div>
                </div>

                {selectedDevice.batteryLevel && (
                  <div>
                    <span className="text-gray-600">Battery:</span>
                    <div className="flex items-center space-x-1">
                      <Battery className="h-4 w-4 text-green-600" />
                      <span>{selectedDevice.batteryLevel}%</span>
                    </div>
                  </div>
                )}

                {selectedDevice.emergencyStatus && (
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <div className="flex items-center space-x-1">
                      <AlertTriangle className={`h-4 w-4 ${getEmergencyStatusColor(selectedDevice.emergencyStatus)}`} />
                      <span className={getEmergencyStatusColor(selectedDevice.emergencyStatus)}>
                        {selectedDevice.emergencyStatus}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <span className="text-gray-600 text-sm">Capabilities:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {selectedDevice.capabilities.map((capability) => (
                    <Badge key={capability} variant="outline" className="text-xs">
                      {capability.replace('_', ' ')}
                    </Badge>
                  ))}
                </div>
              </div>

              {selectedDevice.location && (
                <div>
                  <span className="text-gray-600 text-sm">Location:</span>
                  <div className="text-sm mt-1">
                    {formatRounded(selectedDevice.location.latitude, 4)}, {formatRounded(selectedDevice.location.longitude, 4)}
                  </div>
                </div>
              )}

              <div className="flex space-x-2 pt-2">
                <Button
                  onClick={() => {
                    handleConnectToDevice(selectedDevice);
                    setShowDeviceDetails(false);
                  }}
                  className="flex-1"
                  disabled={connectionStatus.isConnected}
                >
                  <Bluetooth className="h-4 w-4 mr-2" />
                  Connect
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeviceDetails(false)}
                  className="flex-1"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
} 