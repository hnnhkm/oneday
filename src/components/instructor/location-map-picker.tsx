"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  useMap,
} from "react-leaflet";
import type { LatLngExpression, Marker as LeafletMarker } from "leaflet";
import L from "leaflet";

/**
 * Leaflet's default marker icon paths break when the library is
 * bundled — webpack can't resolve the images via its "bundled
 * relative to CSS" default. The canonical workaround is to stamp
 * the icon paths at a CDN URL. Executed once at module load.
 */
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })
  ._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  latitude: number | null;
  longitude: number | null;
  /** Fired when the user drags the marker OR the parent re-centers */
  onPinChange: (lat: number, lng: number) => void;
}

const DEFAULT_CENTER: LatLngExpression = [-23.5505, -46.6333]; // São Paulo
const DEFAULT_ZOOM = 13;

/**
 * Child component that reacts to parent-driven latitude/longitude
 * changes and pans the map. Has to live inside MapContainer to
 * call useMap().
 */
function MapRecenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null) {
      map.setView([lat, lng], map.getZoom() ?? DEFAULT_ZOOM);
    }
  }, [lat, lng, map]);
  return null;
}

export function LocationMapPicker({
  latitude,
  longitude,
  onPinChange,
}: Props) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const center: LatLngExpression = useMemo(
    () =>
      latitude != null && longitude != null
        ? [latitude, longitude]
        : DEFAULT_CENTER,
    [latitude, longitude]
  );

  const eventHandlers = useMemo(
    () => ({
      dragend() {
        const marker = markerRef.current;
        if (!marker) return;
        const pos = marker.getLatLng();
        onPinChange(pos.lat, pos.lng);
      },
    }),
    [onPinChange]
  );

  return (
    <div className="h-64 rounded-lg overflow-hidden border border-charcoal-lighter/20">
      <MapContainer
        center={center}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom={false}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapRecenter lat={latitude} lng={longitude} />
        {latitude != null && longitude != null && (
          <Marker
            draggable
            eventHandlers={eventHandlers}
            position={[latitude, longitude]}
            ref={(instance) => {
              markerRef.current = instance;
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
