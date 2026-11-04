import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, Bluetooth, Signal, Battery } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { bluetoothService, type DiscoveredNode } from "@/lib/bluetooth-service";
import { networkSimulation } from "@/lib/network-simulation";
import { formatRounded } from "@/lib/utils";

interface SOSButtonProps {
  userLocation: { latitude: number; longitude: number };
}

export function SOSButton({ userLocation }: SOSButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [bleDevices, setBleDevices] = useState<DiscoveredNode[]>([]);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    // Subscribe to BLE devices for emergency broadcasting
    const unsubscribe = bluetoothService.subscribe((devices) => {
      setBleDevices(devices);
    });

    return () => unsubscribe();
  }, []);

  const sosMutation = useMutation({
    mutationFn: async () => {
      // Enable emergency mode in network simulation
      networkSimulation.setEmergencyMode(true);
      setEmergencyMode(true);

      // Send SOS via network API
      const response = await apiRequest("POST", "/api/sos", {
        senderId: "user",
        location: userLocation,
        content: `Emergency SOS Alert! I need immediate assistance. My current location is ${formatRounded(userLocation.latitude, 4)}, ${formatRounded(userLocation.longitude, 4)}`,
      });
      return response.json();
    },
    onSuccess: async (data) => {
      // Send SOS to all connected BLE devices
      const blePromises = bleDevices.map(async (device) => {
        try {
          const success = await bluetoothService.sendMessage(
            device.id, 
            `SOS: Emergency at ${formatRounded(userLocation.latitude, 4)}, ${formatRounded(userLocation.longitude, 4)}`
          );
          return { device, success };
        } catch (error) {
          return { device, success: false };
        }
      });

      const bleResults = await Promise.all(blePromises);
      const successfulBleDevices = bleResults.filter(result => result.success);

      toast({
        title: "SOS Alert Sent",
        description: `Emergency broadcast sent to ${data.recipientCount} network nodes and ${successfulBleDevices.length} BLE devices`,
        duration: 5000,
      });

      // Cisco Meraki gateway picked up the SOS and uplinked it to the cloud
      if (data.ciscoUplink) {
        toast({
          title: "☁ Uplinked to Cisco Cloud",
          description: `${data.ciscoUplink.gatewayName} forwarded your SOS over LTE — Webex Crisis Room alerted (${data.ciscoUplink.event.latencyMs}ms)`,
          duration: 7000,
        });
      }

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/network/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cisco/uplink"] });
      
      setIsOpen(false);

      // Disable emergency mode after 5 minutes
      setTimeout(() => {
        networkSimulation.setEmergencyMode(false);
        setEmergencyMode(false);
        toast({
          title: "Emergency Mode Disabled",
          description: "Returned to normal operation mode",
        });
      }, 300000); // 5 minutes
    },
    onError: () => {
      toast({
        title: "Failed to Send SOS",
        description: "Please check your connection and try again",
        variant: "destructive",
      });
    },
  });

  const handleSOS = () => {
    sosMutation.mutate();
  };

  const getConnectedBLEDevices = () => {
    return bleDevices.filter(device => device.rssi > -70); // Good signal strength
  };

  const getEmergencyBLEDevices = () => {
    return bleDevices.filter(device => 
      device.emergencyStatus === 'critical' || device.emergencyStatus === 'warning'
    );
  };

  return (
    <>
      <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
        <AlertDialogTrigger asChild>
          <Button
            size="lg"
            className={`w-16 h-16 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 transform hover:scale-105 fixed bottom-32 right-4 ${
              emergencyMode 
                ? 'bg-red-700 hover:bg-red-800 animate-pulse' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            <AlertTriangle className="h-6 w-6 text-white" />
          </Button>
        </AlertDialogTrigger>
        
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-white" />
              </div>
            </div>
            <AlertDialogTitle className="text-center">Send Emergency Alert?</AlertDialogTitle>
            <AlertDialogDescription className="text-center space-y-3">
              <p>
                This will broadcast your location and emergency status to all connected nodes in the network.
              </p>
              
              {/* BLE Device Status */}
              {bleDevices.length > 0 && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <div className="flex items-center text-blue-800 mb-2">
                    <Bluetooth className="h-4 w-4 mr-2" />
                    <span className="text-sm font-medium">Bluetooth LE Devices</span>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span>Connected Devices:</span>
                      <span className="text-green-600">{getConnectedBLEDevices().length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Emergency Alerts:</span>
                      <span className="text-red-600">{getEmergencyBLEDevices().length}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Network Status */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center text-gray-800 mb-2">
                  <Signal className="h-4 w-4 mr-2" />
                  <span className="text-sm font-medium">Network Status</span>
                </div>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span>Network Mode:</span>
                    <span className="text-purple-600">Mesh Topology</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Routing Algorithm:</span>
                    <span className="text-orange-600">Dijkstra's</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <AlertDialogFooter className="flex flex-col space-y-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction
              onClick={handleSOS}
              disabled={sosMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {sosMutation.isPending ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </div>
              ) : (
                <div className="flex items-center">
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Send SOS Alert
                </div>
              )}
            </AlertDialogAction>
            <AlertDialogCancel className="w-full">Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Emergency Mode Indicator */}
      {emergencyMode && (
        <div className="fixed top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg animate-pulse">
          <div className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            <span className="text-sm font-medium">EMERGENCY MODE ACTIVE</span>
          </div>
        </div>
      )}
    </>
  );
}
