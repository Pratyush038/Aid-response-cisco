import { useEffect, useMemo, useState, useRef } from "react";
import "mapbox-gl/dist/mapbox-gl.css";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { NetworkNode, NetworkConnection, NetworkStats, SosEvent } from "@/types/network";
import { locationService } from "@/lib/location-service";
import { formatRounded } from "@/lib/utils";
import { calculateOptimalRoute } from "@/lib/dijkstra";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MapPin,
  Signal,
  Activity,
  Search,
  Network,
  Info,
  Layers,
  Zap,
  Shield,
  Satellite,
  Navigation,
  Users,
  Battery,
  Wifi,

  AlertTriangle
} from "lucide-react";
import { NetworkToolkit, type PickMode } from "@/components/dashboard/network-toolkit";
import { MerakiDashboard } from "@/components/meraki-dashboard";

// Import Mapbox GL dynamically
let mapboxgl: any;

export default function Maps() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const sosMarkersRef = useRef<Map<number, any>>(new Map());
  const currentStyleRef = useRef("mapbox://styles/mapbox/streets-v12");
  
  const [gpsLocation, setGpsLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy: number;
  } | null>(null);

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite' | 'dark'>('streets');
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [show3D, setShow3D] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [styleRevision, setStyleRevision] = useState(0);

  // Dijkstra route planner state
  const [routeSource, setRouteSource] = useState<string | null>(null);
  const [routeDest, setRouteDest] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const pickModeRef = useRef<PickMode>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const updateLocationMutation = useMutation({
    mutationFn: async (coords: { latitude: number; longitude: number }) => {
      const res = await apiRequest("POST", "/api/users/location", coords);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Location Updated", description: "Successfully attached to nearest node." });
    },
    onError: () => {
      toast({ title: "Failed to place", description: "Could not update location.", variant: "destructive" });
    }
  });

  useEffect(() => {
    pickModeRef.current = pickMode;
    if (mapInstanceRef.current) {
      mapInstanceRef.current.getCanvas().style.cursor = pickMode ? "crosshair" : "";
    }
  }, [pickMode]);

  const { data: nodes = [] } = useQuery<NetworkNode[]>({
    queryKey: ["/api/nodes"],
    refetchInterval: 5000,
  });

  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    refetchInterval: 5000,
  });

  const { data: authStatus } = useQuery<{ username: string }>({
    queryKey: ["/api/auth/me"],
  });
  const currentUser = allUsers.find(u => u.username === authStatus?.username);

  const { data: connections = [] } = useQuery<NetworkConnection[]>({
    queryKey: ["/api/connections"],
    refetchInterval: 5000,
  });

  const { data: stats } = useQuery<NetworkStats>({
    queryKey: ["/api/network/stats"],
    refetchInterval: 2000,
  });

  // Active SOS alerts — drawn as pulsing red origin markers + red route lines.
  // The EmergencyPanel's SSE listener invalidates this query the instant an
  // SOS fires, so the map reacts in real time.
  const { data: sosEvents = [] } = useQuery<SosEvent[]>({
    queryKey: ["/api/sos/events"],
    refetchInterval: 5000,
  });

  // Only links whose both endpoints are online are routable — this is what
  // makes the gold path self-heal the moment a node is killed.
  const routableConnections = useMemo(() => {
    const onlineIds = new Set(nodes.filter((node) => node.isOnline).map((node) => node.nodeId));
    return connections.filter(
      (conn) => conn.isActive && onlineIds.has(conn.fromNodeId) && onlineIds.has(conn.toNodeId),
    );
  }, [nodes, connections]);

  const route = useMemo(() => {
    if (!routeSource || !routeDest || routeSource === routeDest) return null;
    
    // Resolve user to their nearest node
    const getTargetNodeId = (id: string) => {
      const user = allUsers.find(u => u.username === id);
      return user?.nearestNodeId || id;
    };

    const sourceNodeId = getTargetNodeId(routeSource);
    const destNodeId = getTargetNodeId(routeDest);
    
    if (!sourceNodeId || !destNodeId) return null;

    const source = nodes.find((node) => node.nodeId === sourceNodeId);
    const dest = nodes.find((node) => node.nodeId === destNodeId);
    if (!source?.isOnline || !dest?.isOnline) return null;
    return calculateOptimalRoute(nodes, routableConnections, sourceNodeId, destNodeId);
  }, [nodes, routableConnections, routeSource, routeDest, allUsers]);

  const routeLatencyMs = useMemo(() => {
    if (!route) return null;
    let total = 0;
    for (let index = 0; index < route.path.length - 1; index += 1) {
      const a = route.path[index];
      const b = route.path[index + 1];
      const conn = connections.find(
        (item) =>
          (item.fromNodeId === a && item.toNodeId === b) ||
          (item.fromNodeId === b && item.toNodeId === a),
      );
      total += conn?.latency ?? 0;
    }
    return total;
  }, [route, connections]);

  // Announce self-healing: same endpoints, but the path changed (or vanished).
  const prevRouteRef = useRef<{ key: string; path: string[] } | null>(null);
  useEffect(() => {
    const key = routeSource && routeDest ? `${routeSource}->${routeDest}` : null;
    const prev = prevRouteRef.current;
    const nodeName = (nodeId: string) => nodes.find((node) => node.nodeId === nodeId)?.name ?? nodeId;

    if (key && prev && prev.key === key && prev.path.length > 0) {
      const currentJoined = route?.path.join("→") ?? null;
      if (currentJoined && currentJoined !== prev.path.join("→")) {
        toast({
          title: "🔄 Route self-healed",
          description: `Dijkstra found a new path: ${route!.path.map(nodeName).join(" → ")}`,
          duration: 6000,
        });
      } else if (!route) {
        toast({
          title: "⚠️ Mesh partitioned",
          description: "No surviving path between the selected nodes. Restore a node to reconnect.",
          variant: "destructive",
          duration: 6000,
        });
      }
    }

    prevRouteRef.current = key ? { key, path: route?.path ?? [] } : null;
  }, [route, routeSource, routeDest, nodes, toast]);

  const getFallbackNodePosition = (node: NetworkNode) => {
    const centerLat = 12.9249;
    const centerLon = 77.4996;
    const x = (node.longitude - centerLon) * 8500 + 50;
    const y = (centerLat - node.latitude) * 8500 + 50;

    return {
      x: Math.max(8, Math.min(92, x)),
      y: Math.max(10, Math.min(90, y)),
    };
  };

  // Mapbox paints layers in add-order, and effect timing can add the green
  // connection layers AFTER the route layers (hiding the yellow path under
  // them). Explicitly hoisting the route layers to the top of the stack after
  // every layer mutation makes the ordering deterministic.
  const ROUTE_LAYER_IDS = ["dijkstra-route-glow", "dijkstra-route-casing", "dijkstra-route-core", "dijkstra-route-arrows"];
  const hoistRouteLayers = (map: any) => {
    try {
      ROUTE_LAYER_IDS.forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.moveLayer(layerId); // no beforeId → move to very top
        }
      });
    } catch {
      // Style mid-swap — the styleRevision bump will rerun the effects.
    }
  };

  const addBuildingsLayer = (map: any) => {
    if (!map.getSource("composite") || map.getLayer("3d-buildings")) return;

    map.addLayer({
      id: "3d-buildings",
      source: "composite",
      "source-layer": "building",
      filter: ["==", "extrude", "true"],
      type: "fill-extrusion",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": "#aaa",
        "fill-extrusion-height": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15,
          0,
          15.05,
          ["get", "height"],
        ],
        "fill-extrusion-base": [
          "interpolate",
          ["linear"],
          ["zoom"],
          15,
          0,
          15.05,
          ["get", "min_height"],
        ],
        "fill-extrusion-opacity": 0.6,
      },
    });
  };

  // Initialize Mapbox map
  useEffect(() => {
    const initMap = async () => {
      if (!mapRef.current || mapInstanceRef.current) return;
      
      try {
        const mapboxToken = import.meta.env.VITE_MAPBOX_API_KEY;
        if (!mapboxToken) {
          throw new Error("Mapbox token is not configured");
        }

        const tokenCheck = await fetch(
          `https://api.mapbox.com/styles/v1/mapbox/streets-v12?access_token=${mapboxToken}`,
        );

        if (!tokenCheck.ok) {
          const errorPayload = await tokenCheck.json().catch(() => null);
          throw new Error(
            errorPayload?.message || `Mapbox token check failed with HTTP ${tokenCheck.status}`,
          );
        }

        // Import Mapbox GL
        const mapbox = await import('mapbox-gl');
        mapboxgl = mapbox.default;
        
        // Set access token
        mapboxgl.accessToken = mapboxToken;
        
        // Use current GPS location or fallback to RV College
        const centerLng = gpsLocation?.longitude || 77.4996;
        const centerLat = gpsLocation?.latitude || 12.9249;
        
        // Create map centered on user's location
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [centerLng, centerLat],
          zoom: 15,
          pitch: 0,
          bearing: 0,
          antialias: true
        });

        // Add navigation controls
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');
        
        // Add geolocate control
        const geolocateControl = new mapboxgl.GeolocateControl({
          positionOptions: {
            enableHighAccuracy: true
          },
          trackUserLocation: true,
          showUserHeading: true
        });
        map.addControl(geolocateControl, 'top-right');

        map.on("error", (event: any) => {
          const message = event?.error?.message || "Mapbox could not load map resources";
          setMapError(message);
        });

        // Wait for map to load
        map.on('load', () => {
          setMapLoaded(true);
          setMapError(null);
          addBuildingsLayer(map);
          setStyleRevision((revision) => revision + 1);
        });

        map.on('click', (e: any) => {
          const mode = pickModeRef.current;
          if (mode === 'place') {
            updateLocationMutation.mutate({ latitude: e.lngLat.lat, longitude: e.lngLat.lng });
            setPickMode(null);
          }
        });

        mapInstanceRef.current = map;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Mapbox failed to initialize";
        setMapError(message);
        setMapLoaded(false);
      }
    };

    initMap();
    
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch map styles
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      const map = mapInstanceRef.current;
      let styleUrl = '';
      
      switch (mapStyle) {
        case 'satellite':
          styleUrl = 'mapbox://styles/mapbox/satellite-streets-v12';
          break;
        case 'dark':
          styleUrl = 'mapbox://styles/mapbox/dark-v11';
          break;
        default:
          styleUrl = 'mapbox://styles/mapbox/streets-v12';
      }
      if (currentStyleRef.current === styleUrl) return;

      currentStyleRef.current = styleUrl;
      setMapLoaded(false);
      map.once("style.load", () => {
        addBuildingsLayer(map);
        setMapLoaded(true);
        setMapError(null);
        setStyleRevision((revision) => revision + 1);
      });

      map.setStyle(styleUrl);
    }
  }, [mapStyle, mapLoaded]);

  // Toggle 3D view
  useEffect(() => {
    if (mapInstanceRef.current && mapLoaded) {
      const map = mapInstanceRef.current;
      map.easeTo({
        pitch: show3D ? 45 : 0,
        duration: 1000
      });
    }
  }, [show3D, mapLoaded]);

  // GPS location tracking and map centering
  useEffect(() => {
    const unsubscribe = locationService.subscribe((location) => {
      const newLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      };
      setGpsLocation(newLocation);
      
      // Update map center when location changes
      if (mapInstanceRef.current && mapLoaded) {
        mapInstanceRef.current.easeTo({
          center: [location.longitude, location.latitude],
          duration: 1000
        });
      }
    });

    locationService.getCurrentLocation().then((location) => {
      setGpsLocation({
        latitude: location.latitude,
        longitude: location.longitude,
        accuracy: location.accuracy,
      });
    }).catch(() => {
      // Set default to RV College location if GPS fails
      setGpsLocation({
        latitude: 12.9249,
        longitude: 77.4996,
        accuracy: 100,
      });
    });

    locationService.startWatching();
    
    return () => {
      unsubscribe();
      locationService.stopWatching();
    };
  }, []);

  // Update network markers
  useEffect(() => {
    if (!mapboxgl || !mapInstanceRef.current || !nodes.length || !mapLoaded) return;

    const map = mapInstanceRef.current;
    if (!map.isStyleLoaded()) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    // Segments that belong to the current Dijkstra route (both directions) —
    // these are painted yellow directly on the connection layer itself.
    const routeSegments = new Set<string>();
    if (route) {
      for (let index = 0; index < route.path.length - 1; index += 1) {
        routeSegments.add(`${route.path[index]}|${route.path[index + 1]}`);
        routeSegments.add(`${route.path[index + 1]}|${route.path[index]}`);
      }
    }

    // Add connection lines. A link only renders as active when the flag is set
    // AND both endpoints are online — an offline node can never show a live link,
    // even if the server briefly reports stale connection state.
    const connectionFeatures = connections.map(connection => {
      const fromNode = nodes.find(n => n.nodeId === connection.fromNodeId);
      const toNode = nodes.find(n => n.nodeId === connection.toNodeId);

      if (fromNode && toNode) {
        return {
          type: 'Feature',
          properties: {
            isActive: connection.isActive && fromNode.isOnline && toNode.isOnline,
            onRoute: routeSegments.has(`${connection.fromNodeId}|${connection.toNodeId}`)
          },
          geometry: {
            type: 'LineString',
            coordinates: [
              [fromNode.longitude, fromNode.latitude],
              [toNode.longitude, toNode.latitude]
            ]
          }
        };
      }
      return null;
    }).filter(Boolean);

    try {
      // Update or add connections source
      if (map.getSource('network-connections')) {
        map.getSource('network-connections').setData({
          type: 'FeatureCollection',
          features: connectionFeatures
        });
      } else {
        map.addSource('network-connections', {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: connectionFeatures
          }
        });

        // Add connection layers
        map.addLayer({
          id: 'active-connections',
          type: 'line',
          source: 'network-connections',
          filter: ['==', ['get', 'isActive'], true],
          paint: {
            'line-color': '#10b981',
            'line-width': 3,
            'line-opacity': 0.8
          }
        });

        map.addLayer({
          id: 'inactive-connections',
          type: 'line',
          source: 'network-connections',
          filter: ['==', ['get', 'isActive'], false],
          paint: {
            'line-color': '#6b7280',
            'line-width': 2,
            'line-opacity': 0.4,
            'line-dasharray': [2, 2]
          }
        });
      }

      // Paint route segments yellow ON the connection layer itself — the green
      // line literally turns yellow along the shortest path, so the highlight
      // can never be hidden by layer stacking. Re-applied every run.
      if (map.getLayer('active-connections')) {
        map.setPaintProperty('active-connections', 'line-color', [
          'case', ['to-boolean', ['get', 'onRoute']], '#facc15', '#10b981',
        ]);
        map.setPaintProperty('active-connections', 'line-width', [
          'case', ['to-boolean', ['get', 'onRoute']], 6, 3,
        ]);
        map.setPaintProperty('active-connections', 'line-opacity', [
          'case', ['to-boolean', ['get', 'onRoute']], 1, 0.8,
        ]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to render network overlays";
      setMapError(message);
      return;
    }

    // Keep the yellow Dijkstra path above the freshly (re)added link layers
    hoistRouteLayers(map);

    // Add node markers
    nodes.forEach(node => {
      const markerEl = document.createElement('div');
      markerEl.className = 'network-marker';

      const isCiscoGateway = node.role === "cisco-gateway" || node.nodeId === "cisco-gateway";
      const isRouteSource = node.nodeId === routeSource;
      const isRouteDest = node.nodeId === routeDest;
      const isOnRoutePath = Boolean(route?.path.includes(node.nodeId)) && !isRouteSource && !isRouteDest;

      // Route-planner pick mode: clicking a marker selects it as source/dest
      // instead of opening the popup (registered first, so it can swallow the
      // click before Mapbox's popup toggle runs).
      markerEl.addEventListener(
        'click',
        (event) => {
          const mode = pickModeRef.current;
          if (!mode) return;
          event.stopImmediatePropagation();
          event.stopPropagation();
          if (mode === 'source') {
            setRouteSource(node.nodeId);
          } else {
            setRouteDest(node.nodeId);
          }
          setPickMode(null);
        },
        true,
      );

      let iconColor = '#10b981';
      let iconEmoji = '📱';
      if (isCiscoGateway) {
        iconColor = '#049fd9'; // Cisco signature blue
        iconEmoji = '☁️';
      } else if (node.nodeId === "user") {
        iconColor = '#3b82f6';
        iconEmoji = '👤';
      } else if (node.name.includes("Emergency")) {
        iconColor = '#ef4444';
        iconEmoji = '🚨';
      } else if (node.name.includes("Relay")) {
        iconColor = '#8b5cf6';
        iconEmoji = '📡';
      }

      markerEl.innerHTML = `
        <div class="relative">
          ${isCiscoGateway && node.isOnline ? `
            <div class="cisco-uplink-ring absolute -inset-2 rounded-full border-2" style="border-color: #049fd9"></div>
            <div class="cisco-uplink-ring absolute -inset-2 rounded-full border-2" style="border-color: #22d3ee; animation-delay: 0.9s"></div>
          ` : ''}
          ${isRouteSource || isRouteDest ? `
            <div class="absolute -inset-1.5 rounded-full border-[3px] route-endpoint-ring"
                 style="border-color: ${isRouteSource ? '#2563eb' : '#f59e0b'}"></div>
          ` : ''}
          ${isOnRoutePath ? `
            <div class="absolute -inset-1 rounded-full border-2 border-dashed" style="border-color: #fbbf24"></div>
          ` : ''}
          <div class="w-10 h-10 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-lg ${isCiscoGateway && node.isOnline ? 'cisco-gateway-glow' : ''}"
               style="background-color: ${node.isOnline ? iconColor : '#6b7280'}">
            ${iconEmoji}
          </div>
          ${node.isOnline ? `
            <div class="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white animate-pulse"
                 style="background-color: ${node.signalStrength > 80 ? '#10b981' :
                                          node.signalStrength > 50 ? '#eab308' : '#ef4444'}">
            </div>
          ` : ''}
          ${isRouteSource ? `
            <div class="absolute -top-3 -left-2 rounded-full bg-blue-600 border border-white text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center shadow">S</div>
          ` : ''}
          ${isRouteDest ? `
            <div class="absolute -top-3 -left-2 rounded-full bg-amber-500 border border-white text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center shadow">D</div>
          ` : ''}
          ${isCiscoGateway ? `
            <div class="absolute -bottom-7 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow"
                 style="background: linear-gradient(90deg, #049fd9, #0284c7)">
              ☁ CLOUD UPLINK
            </div>
          ` : ''}
          ${emergencyMode && !isCiscoGateway ? `
            <div class="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-red-600 text-white text-xs px-2 py-1 rounded animate-pulse">
              EMERGENCY
            </div>
          ` : ''}
        </div>
      `;

      const popupContent = `
        <div class="text-sm max-w-xs">
          <h3 class="font-bold ${isCiscoGateway ? 'text-sky-700' : 'text-blue-900'} mb-2">${isCiscoGateway ? '☁️ ' : ''}${node.name}</h3>
          <div class="space-y-1">
            ${isCiscoGateway ? `
              <div class="mb-2 p-2 rounded text-xs font-semibold" style="background: rgba(4,159,217,0.1); color: #036f97">
                Edge Gateway — bridges the LoRa mesh to the Cisco Cloud via cellular backhaul
              </div>
              <div class="flex justify-between">
                <span>Backhaul:</span>
                <span class="font-semibold" style="color: #049fd9">LTE Active · Satellite Ready</span>
              </div>
              <div class="flex justify-between">
                <span>Cloud Sync:</span>
                <span class="text-green-600 font-semibold">Meraki Dashboard ✓</span>
              </div>
            ` : ''}
            <div class="flex justify-between">
              <span>Status:</span>
              <span class="${node.isOnline ? 'text-green-600' : 'text-red-600'} font-semibold">
                ${node.isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div class="flex justify-between">
              <span>Signal:</span>
              <span class="font-semibold">${node.signalStrength}%</span>
            </div>
            <div class="flex justify-between">
              <span>Coordinates:</span>
              <span class="text-gray-600 text-xs">${formatRounded(node.latitude, 4)}, ${formatRounded(node.longitude, 4)}</span>
            </div>
            ${emergencyMode ? '<div class="mt-2 p-2 bg-red-100 rounded text-red-700 text-xs font-bold">🚨 Emergency Mode Active</div>' : ''}
          </div>
        </div>
      `;

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([node.longitude, node.latitude])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(popupContent))
        .addTo(map);

      markersRef.current.set(node.nodeId, marker);
    });

    // Add user markers
    allUsers.forEach((user: any) => {
      if (!user.latitude || !user.longitude) return;
      const markerEl = document.createElement('div');
      markerEl.className = 'network-marker';
      
      const isRouteSource = user.username === routeSource;
      const isRouteDest = user.username === routeDest;

      markerEl.innerHTML = `
        <div class="relative">
          ${isRouteSource || isRouteDest ? `
            <div class="absolute -inset-1.5 rounded-full border-[3px] route-endpoint-ring"
                 style="border-color: ${isRouteSource ? '#2563eb' : '#f59e0b'}"></div>
          ` : ''}
          <div class="w-8 h-8 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-sm bg-blue-500">
            👤
          </div>
          <div class="absolute -bottom-5 left-1/2 transform -translate-x-1/2 whitespace-nowrap text-slate-800 bg-white/80 backdrop-blur text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
            ${user.username}
          </div>
          ${isRouteSource ? `
            <div class="absolute -top-3 -left-2 rounded-full bg-blue-600 border border-white text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center shadow">S</div>
          ` : ''}
          ${isRouteDest ? `
            <div class="absolute -top-3 -left-2 rounded-full bg-amber-500 border border-white text-white text-[9px] font-bold w-5 h-5 flex items-center justify-center shadow">D</div>
          ` : ''}
        </div>
      `;

      markerEl.addEventListener('click', (event) => {
        const mode = pickModeRef.current;
        if (!mode || mode === 'place') return;
        event.stopImmediatePropagation();
        event.stopPropagation();
        if (mode === 'source') setRouteSource(user.username);
        else setRouteDest(user.username);
        setPickMode(null);
      }, true);

      const marker = new mapboxgl.Marker(markerEl)
        .setLngLat([user.longitude, user.latitude])
        .addTo(map);
      markersRef.current.set('user-' + user.id, marker);

      // Draw tether line if attached to a node
      if (user.nearestNodeId) {
        const attachedNode = nodes.find(n => n.nodeId === user.nearestNodeId);
        if (attachedNode) {
          const sourceId = 'tether-' + user.id;
          if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData({
              type: 'Feature',
              geometry: {
                type: 'LineString',
                coordinates: [
                  [user.longitude, user.latitude],
                  [attachedNode.longitude, attachedNode.latitude]
                ]
              }
            });
          } else {
            map.addSource(sourceId, {
              type: 'geojson',
              data: {
                type: 'Feature',
                geometry: {
                  type: 'LineString',
                  coordinates: [
                    [user.longitude, user.latitude],
                    [attachedNode.longitude, attachedNode.latitude]
                  ]
                }
              }
            });
            map.addLayer({
              id: 'layer-' + sourceId,
              type: 'line',
              source: sourceId,
              paint: {
                'line-color': '#3b82f6',
                'line-width': 1.5,
                'line-dasharray': [3, 3],
                'line-opacity': 0.6
              }
            });
          }
        }
      }
    });

    // Handle map clicks for placing new objects
    const handleMapClick = (e: any) => {
      const mode = pickModeRef.current;
      if (mode === 'place') {
        const { lng, lat } = e.lngLat;
        updateLocationMutation.mutate({ latitude: lat, longitude: lng });
        setPickMode(null);
      }
    };
    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };

  }, [nodes, connections, emergencyMode, mapLoaded, styleRevision, routeSource, routeDest, route, allUsers]);

  // Draw the Dijkstra shortest path as a glowing gold line above the mesh links
  useEffect(() => {
    if (!mapboxgl || !mapInstanceRef.current || !mapLoaded) return;
    const map = mapInstanceRef.current;
    if (!map.isStyleLoaded()) return;

    const coordinates = route
      ? route.path
          .map((nodeId) => nodes.find((node) => node.nodeId === nodeId))
          .filter((node): node is NetworkNode => Boolean(node))
          .map((node) => [node.longitude, node.latitude])
      : [];

    const data = {
      type: 'FeatureCollection',
      features:
        coordinates.length >= 2
          ? [
              {
                type: 'Feature',
                properties: {},
                geometry: { type: 'LineString', coordinates },
              },
            ]
          : [],
    };

    try {
      if (map.getSource('dijkstra-route')) {
        map.getSource('dijkstra-route').setData(data);
      } else {
        map.addSource('dijkstra-route', { type: 'geojson', data });
      }

      // Ensure each layer independently on EVERY run: if one addLayer failed
      // once (style mid-load), it gets created on a later pass instead of
      // being gated forever behind the source-exists check.
      // Bright yellow route: soft glow underneath, dark amber casing for
      // contrast on light map styles, vivid yellow core on top.
      if (!map.getLayer('dijkstra-route-glow')) {
        map.addLayer({
          id: 'dijkstra-route-glow',
          type: 'line',
          source: 'dijkstra-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#facc15',
            'line-width': 18,
            'line-opacity': 0.4,
            'line-blur': 8,
          },
        });
      }

      if (!map.getLayer('dijkstra-route-casing')) {
        map.addLayer({
          id: 'dijkstra-route-casing',
          type: 'line',
          source: 'dijkstra-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#a16207',
            'line-width': 9,
            'line-opacity': 0.95,
          },
        });
      }

      if (!map.hasImage('route-arrow')) {
        const img = new Image();
        img.onload = () => {
          if (!map.hasImage('route-arrow')) {
            map.addImage('route-arrow', img);
          }
          // Force a repaint if the layer was already added but waiting for the image
          map.triggerRepaint();
        };
        img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M5 4 L21 12 L5 20 L9 12 Z" fill="#78350f" stroke="#fde047" stroke-width="1.5" stroke-linejoin="round"/>
          </svg>
        `);
      }

      if (!map.getLayer('dijkstra-route-core')) {
        map.addLayer({
          id: 'dijkstra-route-core',
          type: 'line',
          source: 'dijkstra-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#fde047',
            'line-width': 10,
            'line-opacity': 1,
          },
        });
      }

      if (!map.getLayer('dijkstra-route-arrows')) {
        map.addLayer({
          id: 'dijkstra-route-arrows',
          type: 'symbol',
          source: 'dijkstra-route',
          layout: {
            'symbol-placement': 'line',
            'symbol-spacing': 50,
            'icon-image': 'route-arrow',
            'icon-size': 0.8,
            'icon-keep-upright': false,
            'icon-allow-overlap': true,
            'icon-ignore-placement': true,
          },
          paint: {},
        });
      }

      // Always repaint the route above the green/grey connection layers,
      // regardless of which effect added its layers first.
      hoistRouteLayers(map);
    } catch {
      // Style is mid-swap; the styleRevision bump will retrigger this effect.
    }
  }, [route, nodes, mapLoaded, styleRevision]);

  // ---- SOS overlay: pulsing red halo at the origin + red route line ----
  useEffect(() => {
    if (!mapboxgl || !mapInstanceRef.current || !mapLoaded) return;
    const map = mapInstanceRef.current;
    if (!map.isStyleLoaded()) return;

    const activeSos = sosEvents.filter((event) => !event.isResolved);

    // One red line per active SOS, tracing its mesh path to the gateway
    const features = activeSos
      .map((event) => {
        const coords = (event.routingPath ?? [])
          .map((nodeId) => nodes.find((node) => node.nodeId === nodeId))
          .filter((node): node is NetworkNode => Boolean(node))
          .map((node) => [node.longitude, node.latitude]);
        return coords.length >= 2
          ? { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: coords } }
          : null;
      })
      .filter(Boolean);

    const data = { type: 'FeatureCollection', features };

    try {
      if (map.getSource('sos-route')) {
        map.getSource('sos-route').setData(data);
      } else {
        map.addSource('sos-route', { type: 'geojson', data });
      }

      if (!map.getLayer('sos-route-glow')) {
        map.addLayer({
          id: 'sos-route-glow',
          type: 'line',
          source: 'sos-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ef4444',
            'line-width': 14,
            'line-opacity': 0.35,
            'line-blur': 6,
          },
        });
      }

      if (!map.getLayer('sos-route-core')) {
        map.addLayer({
          id: 'sos-route-core',
          type: 'line',
          source: 'sos-route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': '#ef4444',
            'line-width': 4,
            'line-opacity': 0.95,
            'line-dasharray': [2, 1.2],
          },
        });
      }

      // Stacking: SOS red above the mesh links, Dijkstra yellow on very top
      ['sos-route-glow', 'sos-route-core'].forEach((layerId) => {
        if (map.getLayer(layerId)) map.moveLayer(layerId);
      });
      hoistRouteLayers(map);
    } catch {
      // Style mid-swap — styleRevision bump retriggers this effect.
    }

    // Pulsing DOM markers at each SOS origin
    sosMarkersRef.current.forEach((marker) => marker.remove());
    sosMarkersRef.current.clear();
    for (const event of activeSos) {
      const el = document.createElement('div');
      el.className = 'relative flex h-12 w-12 items-center justify-center';
      el.innerHTML = `
        <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-60"></span>
        <span class="absolute inline-flex h-8 w-8 animate-ping rounded-full bg-red-400 opacity-50" style="animation-delay:0.35s"></span>
        <span class="relative flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white ring-2 ring-white shadow-xl">SOS</span>
      `;
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([event.longitude, event.latitude])
        .addTo(map);
      sosMarkersRef.current.set(event.id, marker);
    }
  }, [sosEvents, nodes, mapLoaded, styleRevision]);

  return (
    <div className="flex flex-col h-full relative overflow-hidden">
      {/* Mapbox Container - Full height with proper z-index */}
      <div ref={mapRef} className="w-full h-full absolute inset-0 z-0" />

      {/* Cisco Meraki Dashboard (top-center trigger + modal) */}
      <MerakiDashboard />

      {/* Fallback view if Mapbox fails */}
      {!mapLoaded && (
        <div className="absolute inset-0 z-10 bg-slate-100">
          <div className="absolute inset-6 bottom-28 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
            <svg viewBox="0 0 100 100" className="h-full w-full bg-[radial-gradient(circle_at_50%_45%,#dbeafe,transparent_34%),linear-gradient(135deg,#f8fafc,#e2e8f0)]">
              {connections.map((connection) => {
                const fromNode = nodes.find((node) => node.nodeId === connection.fromNodeId);
                const toNode = nodes.find((node) => node.nodeId === connection.toNodeId);
                if (!fromNode || !toNode) return null;

                const from = getFallbackNodePosition(fromNode);
                const to = getFallbackNodePosition(toNode);
                const isUsable = connection.isActive && fromNode.isOnline && toNode.isOnline;

                return (
                  <line
                    key={connection.id}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={isUsable ? "#10b981" : "#94a3b8"}
                    strokeWidth={isUsable ? 0.45 : 0.3}
                    strokeDasharray={isUsable ? undefined : "1.2 1.2"}
                    opacity={isUsable ? 0.72 : 0.55}
                  />
                );
              })}
              {route && (() => {
                const points = route.path
                  .map((nodeId) => nodes.find((node) => node.nodeId === nodeId))
                  .filter((node): node is NetworkNode => Boolean(node))
                  .map((node) => {
                    const position = getFallbackNodePosition(node);
                    return `${position.x},${position.y}`;
                  })
                  .join(" ");

                return (
                  <g>
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#a16207"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity="0.9"
                    />
                    <polyline
                      points={points}
                      fill="none"
                      stroke="#fde047"
                      strokeWidth="0.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              })()}
              {nodes.map((node) => {
                const position = getFallbackNodePosition(node);
                const isCiscoGateway = node.role === "cisco-gateway" || node.nodeId === "cisco-gateway";
                const color = isCiscoGateway
                  ? "#049fd9"
                  : node.nodeId === "user"
                    ? "#2563eb"
                    : node.isOnline
                      ? "#10b981"
                      : "#64748b";

                return (
                  <g key={node.nodeId}>
                    {isCiscoGateway && node.isOnline && (
                      <circle
                        cx={position.x}
                        cy={position.y}
                        r="3.4"
                        fill="none"
                        stroke="#049fd9"
                        strokeWidth="0.4"
                        className="cisco-svg-pulse"
                      />
                    )}
                    <circle cx={position.x} cy={position.y} r="1.9" fill={color} stroke="#ffffff" strokeWidth="0.5" />
                    {isCiscoGateway && (
                      <text x={position.x - 1.1} y={position.y - 2.6} fontSize="2.4">☁️</text>
                    )}
                    <text x={position.x + 2.2} y={position.y + 0.6} fontSize="2.2" fill="#0f172a">
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="absolute left-1/2 top-1/2 w-[min(92vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-slate-200 bg-white/95 p-5 text-center shadow-sm backdrop-blur">
            <MapPin className="mx-auto mb-3 h-9 w-9 text-blue-600" />
            <div className="text-lg font-semibold text-slate-900">Using local topology map</div>
            <div className="mt-2 text-sm leading-6 text-slate-600">
              {mapError || "Loading Mapbox resources"}
            </div>
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-5 text-amber-900">
              Your current Mapbox token was rejected by Mapbox. Add a valid public token to
              <span className="font-semibold"> .env.local </span>
              as <span className="font-semibold">VITE_MAPBOX_API_KEY</span>, then restart the dev server.
            </div>
          </div>
        </div>
      )}

      {/* Emergency Mode Overlay */}
      {emergencyMode && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-white p-2 text-center font-bold animate-pulse z-50">
          🚨 EMERGENCY MODE ACTIVE - Priority Routing & Location Broadcasting
        </div>
      )}

      {/* Left rail: simulation toolkit + map controls */}
      <div className="pointer-events-none absolute bottom-24 left-4 top-4 z-40 flex w-72 flex-col gap-3 overflow-y-auto pr-1 [&>*]:pointer-events-auto [&>*]:shrink-0">
        <NetworkToolkit
          nodes={nodes}
          users={allUsers}
          currentUser={currentUser}
          routeSource={routeSource}
          routeDest={routeDest}
          onRouteSourceChange={setRouteSource}
          onRouteDestChange={setRouteDest}
          route={route}
          routeLatencyMs={routeLatencyMs}
          pickMode={pickMode}
          onPickModeChange={setPickMode}
        />



      <Card className="w-full border-slate-200/50 bg-white/80 backdrop-blur-md shadow-lg">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center">
            <Layers className="h-4 w-4 mr-2" />
            Map Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <label className="text-xs font-medium">Map Style</label>
            <div className="grid grid-cols-3 gap-1">
              <Button 
                size="sm" 
                variant={mapStyle === 'streets' ? 'default' : 'outline'}
                onClick={() => setMapStyle('streets')}
                className="text-xs"
              >
                Streets
              </Button>
              <Button 
                size="sm" 
                variant={mapStyle === 'satellite' ? 'default' : 'outline'}
                onClick={() => setMapStyle('satellite')}
                className="text-xs"
              >
                <Satellite className="h-3 w-3" />
              </Button>
              <Button 
                size="sm" 
                variant={mapStyle === 'dark' ? 'default' : 'outline'}
                onClick={() => setMapStyle('dark')}
                className="text-xs"
              >
                Dark
              </Button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">3D Buildings</span>
            <Button 
              size="sm" 
              variant={show3D ? 'default' : 'outline'}
              onClick={() => setShow3D(!show3D)}
            >
              📦
            </Button>
          </div>

          <Button
            size="sm"
            variant={emergencyMode ? 'destructive' : 'outline'}
            onClick={() => setEmergencyMode(!emergencyMode)}
            className="w-full text-xs"
          >
            <AlertTriangle className="mr-2 h-4 w-4" />
            {emergencyMode ? 'Disable Emergency Mode' : 'Trigger Emergency'}
          </Button>

          <Button
            size="sm"
            variant={pickMode === 'place' ? 'default' : 'outline'}
            onClick={() => setPickMode(pickMode === 'place' ? null : 'place')}
            className="w-full text-xs"
          >
            <MapPin className="mr-2 h-4 w-4" />
            {pickMode === 'place' ? 'Click map to place' : 'Place Me'}
          </Button>
        </CardContent>
      </Card>
      </div>

      {/* Network Status Panel - Top Right */}
      <Card className="absolute top-4 right-4 w-64 border-slate-200/50 bg-white/80 backdrop-blur-md shadow-lg z-40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Network Status
            </CardTitle>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm">
                  <Info className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md z-50" aria-describedby="network-concepts-description">
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    <Network className="h-5 w-5 mr-2" />
                    Network Concepts
                  </DialogTitle>
                </DialogHeader>
                <div id="network-concepts-description" className="space-y-4 text-sm">
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">🔄 Mesh Topology:</h4>
                    <p className="text-gray-700">Self-healing network where each device connects to multiple others, ensuring communication even when infrastructure fails.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">📊 Dijkstra's Algorithm:</h4>
                    <p className="text-gray-700">Smart pathfinding that automatically finds the best route for messages, adapting to network changes in real-time.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">📡 Packet Switching:</h4>
                    <p className="text-gray-700">Messages split into packets and sent via different paths, then reassembled - ensuring delivery even if some routes fail.</p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900 mb-1">🚨 Emergency Broadcasting:</h4>
                    <p className="text-gray-700">SOS messages use flooding protocol to reach all devices simultaneously for maximum coverage.</p>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {(() => {
            const totalNodes = stats?.totalNodes || nodes.length || 1;
            const onlineNodes = stats?.connectedNodes ?? 0;
            const healthRatio = onlineNodes / totalNodes;
            const healthLabel = healthRatio >= 0.75 ? "Excellent" : healthRatio >= 0.5 ? "Degraded" : "Critical";
            const healthColor = healthRatio >= 0.75 ? "text-green-600" : healthRatio >= 0.5 ? "text-amber-600" : "text-red-600";

            return (
              <div className="flex justify-between items-center">
                <span>Network Health:</span>
                <div className="flex items-center gap-1">
                  <Badge variant={healthRatio >= 0.5 ? "default" : "destructive"}>
                    {onlineNodes}/{totalNodes}
                  </Badge>
                  <span className={healthColor}>{healthLabel}</span>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-between">
            <span>Latency:</span>
            <span className="text-green-600">{stats?.averageLatency || 0}ms</span>
          </div>
          <div className="flex justify-between">
            <span>Algorithm:</span>
            <span className="text-purple-600">Dijkstra</span>
          </div>
          {route && (
            <div className="flex justify-between">
              <span>Active Route:</span>
              <span className="font-semibold text-amber-600">
                {route.hops} hop{route.hops === 1 ? "" : "s"} · ~{routeLatencyMs}ms
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bottom panels with proper spacing for navigation */}
      <div className="absolute bottom-20 left-4 right-4 flex justify-end pointer-events-none z-40">

        {/* Location Panel - Bottom Right */}
        <Card className="w-64 border-slate-200/50 bg-white/80 backdrop-blur-md shadow-lg pointer-events-auto">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center text-red-700">
              <Navigation className="h-4 w-4 mr-2" />
              Location & Status
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {gpsLocation ? (
              <>
                <div>
                  <p className="font-medium">GPS Coordinates:</p>
                  <p className="text-gray-600">{formatRounded(gpsLocation.latitude, 4)}°N, {formatRounded(gpsLocation.longitude, 4)}°E</p>
                </div>
                <div className="flex items-center justify-between">
                  <span>GPS Accuracy:</span>
                  <span className="text-green-600">{formatRounded(gpsLocation.accuracy)}m</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="bg-green-100 p-2 rounded">
                    <div className="text-sm">🔋 85%</div>
                  </div>
                  <div className="bg-green-100 p-2 rounded">
                    <div className="text-sm">📶 Strong</div>
                  </div>
                </div>
                <p className="text-blue-600 font-medium text-center">📍 RV College Area</p>
              </>
            ) : (
              <div className="flex items-center text-yellow-600">
                <Search className="h-3 w-3 mr-1" />
                Acquiring GPS signal...
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <style>{`
        .network-marker {
          cursor: pointer;
          transition: transform 0.2s;
          z-index: 30;
        }
        .network-marker:hover {
          transform: scale(1.1);
        }
        .mapboxgl-popup-content {
          padding: 12px;
          border-radius: 8px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          z-index: 45;
        }
        .mapboxgl-ctrl-group {
          z-index: 35;
        }
        .mapboxgl-ctrl-top-right {
          top: 120px;
          right: 280px;
        }
        .cisco-uplink-ring {
          animation: ciscoUplinkPulse 1.8s ease-out infinite;
        }
        .cisco-gateway-glow {
          box-shadow: 0 0 14px rgba(4, 159, 217, 0.85), 0 0 30px rgba(4, 159, 217, 0.4);
        }
        .cisco-svg-pulse {
          animation: ciscoSvgPulse 1.8s ease-in-out infinite;
          transform-origin: center;
        }
        @keyframes ciscoUplinkPulse {
          0% { transform: scale(0.85); opacity: 0.9; }
          100% { transform: scale(1.9); opacity: 0; }
        }
        @keyframes ciscoSvgPulse {
          0%, 100% { opacity: 0.25; }
          50% { opacity: 0.9; }
        }
        .route-endpoint-ring {
          animation: routeEndpointPulse 1.6s ease-in-out infinite;
        }
        @keyframes routeEndpointPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.4; transform: scale(1.12); }
        }
      `}</style>
    </div>
  );
}
