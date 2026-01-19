'use client';

import { useEffect } from 'react';
import L, { type DragEndEvent, type Map as LeafletMap } from 'leaflet';
import { Circle, MapContainer, Marker, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

type SiteMapProps = {
  center: [number, number];
  zoom: number;
  radius: number;
  onDragEnd: (next: { lat: number; lng: number }) => void;
  onMapReady?: (map: LeafletMap) => void;
};

const MapEffects = ({
  center,
  zoom,
  onMapReady,
}: Pick<SiteMapProps, 'center' | 'zoom' | 'onMapReady'>) => {
  const map = useMap();

  useEffect(() => {
    onMapReady?.(map);
    const id = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(id);
  }, [map, onMapReady]);

  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [map, center, zoom]);

  return null;
};

export default function SiteMap({ center, zoom, radius, onDragEnd, onMapReady }: SiteMapProps) {
  useEffect(() => {
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  return (
    <MapContainer center={center} zoom={zoom} className="h-full w-full">
      <MapEffects center={center} zoom={zoom} onMapReady={onMapReady} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Marker
        position={center}
        draggable={true}
        eventHandlers={{
          dragend: (event: DragEndEvent) => {
            const pos = event.target.getLatLng();
            onDragEnd({ lat: pos.lat, lng: pos.lng });
          },
        }}
      />
      <Circle center={center} radius={radius} />
    </MapContainer>
  );
}

