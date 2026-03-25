"use client";

import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L, { type LeafletMouseEvent } from "leaflet";
import { useEffect, useState } from "react";

type Report = {
  id: number;
  city: string;
  street: string;
  severity: string;
  status: string;
  date: string;
  confirmations: number;
  comment: string;
  lat: number;
  lng: number;
  image?: string;
};

const createIcon = (report: Report) => {
  const color =
    report.status === "Réparé"
      ? "#10b981"
      : report.severity === "Élevée"
      ? "#ef4444"
      : report.severity === "Moyenne"
      ? "#f59e0b"
      : "#d4d4d8";

  return L.divIcon({
    html: `<div style="width:18px;height:18px;border-radius:999px;background:${color};border:3px solid #111827;box-shadow:0 0 0 2px rgba(255,255,255,.15)"></div>`,
    className: "",
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
};

const clickIcon = L.divIcon({
  html: `<div style="width:18px;height:18px;border-radius:999px;background:#3b82f6;border:3px solid #111827;box-shadow:0 0 0 2px rgba(255,255,255,.2)"></div>`,
  className: "",
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function Recenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([lat, lng], Math.max(map.getZoom(), 11), { animate: true });
  }, [lat, lng, map]);

  return null;
}

function ClickHandler({
  onMapClick,
  setClickedPoint,
}: {
  onMapClick: (lat: number, lng: number) => void;
  setClickedPoint: (value: [number, number]) => void;
}) {
  useMapEvents({
    click(e: LeafletMouseEvent) {
      const lat = e.latlng.lat;
      const lng = e.latlng.lng;

      console.log("MAP CLICK OK:", { lat, lng });

      setClickedPoint([lat, lng]);
      onMapClick(lat, lng);
    },
  });

  return null;
}

function ResizeFix() {
  const map = useMap();

  useEffect(() => {
    const id = setTimeout(() => {
      map.invalidateSize();
    }, 300);

    return () => clearTimeout(id);
  }, [map]);

  return null;
}

export default function MapClient({
  reports,
  selected,
  onMapClick,
}: {
  reports: Report[];
  selected: Report | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const center: [number, number] = selected
    ? [selected.lat, selected.lng]
    : [46.8139, -71.2082];

  const [clickedPoint, setClickedPoint] = useState<[number, number] | null>(null);

  return (
    <div className="mapWrap">
      <MapContainer center={center} zoom={7} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
        <ResizeFix />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <ClickHandler onMapClick={onMapClick} setClickedPoint={setClickedPoint} />

        {selected ? <Recenter lat={selected.lat} lng={selected.lng} /> : null}

        {clickedPoint && (
          <Marker position={clickedPoint} icon={clickIcon}>
            <Popup>Point choisi sur la carte</Popup>
          </Marker>
        )}

        {reports.map((report) => (
          <Marker
            key={report.id}
            position={[report.lat, report.lng]}
            icon={createIcon(report)}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong>{report.street}</strong>
                <div>{report.city}</div>
                <div>Gravité : {report.severity}</div>
                <div>Statut : {report.status}</div>
                <div>Confirmations : {report.confirmations}</div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}