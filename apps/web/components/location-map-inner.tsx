"use client";

import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons in Next.js
const defaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const selectedIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [30, 49],
  iconAnchor: [15, 49],
  popupAnchor: [1, -40],
  shadowSize: [49, 49],
  className: "selected-marker",
});

interface Location {
  _id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  currentBookCount: number;
}

interface LocationMapInnerProps {
  locations: Location[];
  selectedId?: string;
  onSelect?: (id: string) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
}

export function LocationMapInner({
  locations,
  selectedId,
  onSelect,
  center = [40.41, 49.87],
  zoom = 12,
  className = "h-[400px] w-full rounded-lg",
}: LocationMapInnerProps) {
  useEffect(() => {
    L.Marker.prototype.options.icon = defaultIcon;
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {locations.map((loc) => (
        <Marker
          key={loc._id}
          position={[loc.lat, loc.lng]}
          icon={loc._id === selectedId ? selectedIcon : defaultIcon}
          eventHandlers={{
            click: () => onSelect?.(loc._id),
          }}
        >
          <Popup>
            <div className="text-sm">
              <p className="font-semibold">{loc.name}</p>
              <p className="text-muted-foreground">{loc.address}</p>
              <p className="mt-1 text-xs">
                {loc.currentBookCount} books available
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
