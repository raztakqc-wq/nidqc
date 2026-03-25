"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

type Report = {
  id: number;
  city: string;
  street: string;
  severity: "Faible" | "Moyenne" | "Élevée";
  status: "Nouveau" | "Transmis" | "Réparé";
  date: string;
  confirmations: number;
  comment: string;
  lat: number;
  lng: number;
  image?: string;
};

const MapClient = dynamic(() => import("../components/MapClient"), { ssr: false });

function formatCoord(value: number) {
  return Number(value).toFixed(5);
}

function severityClass(value: Report["severity"]) {
  return value === "Élevée" ? "badge high" : value === "Moyenne" ? "badge medium" : "badge low";
}

function statusClass(value: Report["status"]) {
  return value === "Réparé" ? "badge fixed" : value === "Transmis" ? "badge sent" : "badge new";
}

function getDotClass(item: Report) {
  return item.status === "Réparé"
    ? "bg-emerald-500"
    : item.severity === "Élevée"
      ? "bg-red-500"
      : item.severity === "Moyenne"
        ? "bg-amber-500"
        : "bg-zinc-300";
}

async function geocodeAddress(city: string, street: string) {
  const query = encodeURIComponent(`${street} ${city}`);
  const res = await fetch(
    `https://photon.komoot.io/api/?q=${query}&limit=5&lat=46.8&lon=-71.2`
  );
  const data = await res.json();

  if (data.features && data.features.length > 0) {
    const best =
      data.features.find((f: any) => {
        const props = f.properties || {};
        const text = JSON.stringify(props).toLowerCase();
        return text.includes("canada") || text.includes("québec") || text.includes("quebec");
      }) || data.features[0];

    const coords = best.geometry.coordinates;

    return {
      lat: coords[1],
      lng: coords[0],
    };
  }

  return null;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card stat">
      <div className="muted" style={{ fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 36, fontWeight: 700, marginTop: 8 }}>{value}</div>
    </div>
  );
}

function TestCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{title}</div>
      <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>{text}</div>
    </div>
  );
}
async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`
  );

  const data = await res.json();

  const address = data.address || {};

  return {
    city:
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      "",
    street:
      address.road ||
      address.pedestrian ||
      address.cycleway ||
      address.footway ||
      "",
  };
}
export default function Page() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filterCity, setFilterCity] = useState("Toutes");
  const [filterStatus, setFilterStatus] = useState("Tous");
  const [filterSeverity, setFilterSeverity] = useState("Toutes");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({
    city: "",
    street: "",
    severity: "Moyenne" as Report["severity"],
    comment: "",
    lat: "",
    lng: "",
    image: "",
  });

  async function loadReports() {
    const res = await fetch("/api/reports", { cache: "no-store" });
    const data = await res.json();
    setReports(data);
    setSelectedId((prev) => prev ?? data[0]?.id ?? null);
  }

  useEffect(() => {
    loadReports().catch(() => setMessage("Impossible de charger les signalements."));
  }, []);

  const cities = useMemo(
    () => ["Toutes", ...Array.from(new Set(reports.map((r) => r.city))).sort()],
    [reports]
  );

  const filteredReports = useMemo(() => {
    return reports.filter((item) => {
      const okCity = filterCity === "Toutes" || item.city === filterCity;
      const okStatus = filterStatus === "Tous" || item.status === filterStatus;
      const okSeverity = filterSeverity === "Toutes" || item.severity === filterSeverity;
      return okCity && okStatus && okSeverity;
    });
  }, [reports, filterCity, filterStatus, filterSeverity]);

  useEffect(() => {
    if (!filteredReports.some((r) => r.id === selectedId)) {
      setSelectedId(filteredReports[0]?.id ?? null);
    }
  }, [filteredReports, selectedId]);

  const selected =
    filteredReports.find((r) => r.id === selectedId) ||
    reports.find((r) => r.id === selectedId) ||
    filteredReports[0] ||
    null;

  const stats = useMemo(() => {
    return {
      actifs: reports.filter((r) => r.status !== "Réparé").length,
      repaired: reports.filter((r) => r.status === "Réparé").length,
      confirmations: reports.reduce((a, b) => a + b.confirmations, 0),
      villes: new Set(reports.map((r) => r.city)).size,
    };
  }, [reports]);

  function setField(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function useMyLocation() {
    if (!navigator.geolocation) {
      setMessage("La géolocalisation n'est pas disponible.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setField("lat", String(Number(position.coords.latitude.toFixed(6))));
        setField("lng", String(Number(position.coords.longitude.toFixed(6))));
        setMessage("Position GPS récupérée.");
      },
      () => setMessage("Impossible de récupérer la position GPS."),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function createReport(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");

    if (!form.city.trim() || !form.street.trim()) {
      setMessage("Ajoute au moins la ville et l'emplacement.");
      return;
    }

    let lat = Number(form.lat);
    let lng = Number(form.lng);

    if (!lat || !lng) {
      const result = await geocodeAddress(form.city, form.street);
      if (!result) {
        setMessage("Adresse introuvable. Essaie avec une rue plus précise ou utilise le GPS.");
        return;
      }
      lat = result.lat;
      lng = result.lng;
      setField("lat", String(lat));
      setField("lng", String(lng));
    }

    if (
      !Number.isFinite(lat) ||
      lat < -90 ||
      lat > 90 ||
      !Number.isFinite(lng) ||
      lng < -180 ||
      lng > 180
    ) {
      setMessage("Ajoute des coordonnées GPS valides.");
      return;
    }

    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        city: form.city.trim(),
        street: form.street.trim(),
        severity: form.severity,
        comment: form.comment.trim(),
        lat,
        lng,
        image: form.image,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || "Erreur lors de l'enregistrement.");
      return;
    }

    setMessage("Signalement enregistré.");
    setForm({
      city: "",
      street: "",
      severity: "Moyenne" as Report["severity"],
      comment: "",
      lat: "",
      lng: "",
      image: "",
    });

    await loadReports();
    setSelectedId(data.id);
  }

  async function updateReport(id: number, action: "confirm" | "send" | "repair") {
    const res = await fetch("/api/reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });

    if (!res.ok) {
      setMessage("Mise à jour impossible.");
      return;
    }

    await loadReports();
    setSelectedId(id);
  }

  async function resetReports() {
    await fetch("/api/reports", { method: "DELETE" });
    await loadReports();
    setMessage("Données réinitialisées.");
  }

  return (
    <div className="page">
      <header className="header-strip">
        <div className="container between">
          <div>
            <div className="muted" style={{ fontSize: 12, letterSpacing: 4, textTransform: "uppercase" }}>
              Québec · Signalement citoyen
            </div>
            <h1 style={{ margin: "6px 0 0", fontSize: 36 }}>NidQC Local</h1>
          </div>

          <div className="row">
            <button className="button secondary small" onClick={loadReports}>Rafraîchir</button>
            <button className="button secondary small" onClick={resetReports}>Réinitialiser</button>
          </div>
        </div>
      </header>

      <main className="container">
        <section className="grid grid-hero">
          <div className="card" style={{ overflow: "hidden" }}>
            <div style={{ padding: 24, borderBottom: "1px solid #27272a" }}>
              <h2 style={{ margin: 0 }}>Carte fonctionnelle</h2>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                OpenStreetMap + Leaflet. Clique sur la carte ou sur “Voir sur carte” dans la liste.
              </div>
            </div>
            <MapClient
  reports={filteredReports}
  selected={selected}
  onMapClick={async (lat, lng) => {
    setField("lat", lat.toFixed(6));
    setField("lng", lng.toFixed(6));

    try {
      const result = await reverseGeocode(lat, lng);

      if (result.city) {
        setField("city", result.city);
      }

      if (result.street) {
        setField("street", result.street);
      }

      setMessage("Position choisie sur la carte 📍");
    } catch (error) {
      console.error("Reverse geocoding error:", error);
      setMessage("Position choisie sur la carte, mais adresse introuvable.");
    }
  }}
/>
          </div>

          <div className="card" style={{ padding: 24 }}>
            <h2 style={{ margin: 0 }}>Nouveau signalement</h2>
            <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
              Sauvegarde réelle dans un fichier JSON local via API Next.js.
            </div>

            <form onSubmit={createReport} style={{ marginTop: 20, display: "grid", gap: 14 }}>
              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Ville</label>
                <input className="input" value={form.city} onChange={(e) => setField("city", e.target.value)} placeholder="Ex. Saint-Jérôme" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Rue / emplacement</label>
                <input className="input" value={form.street} onChange={(e) => setField("street", e.target.value)} placeholder="Ex. Rue Saint-Georges" />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Gravité</label>
                <select className="select" value={form.severity} onChange={(e) => setField("severity", e.target.value)}>
                  <option>Faible</option>
                  <option>Moyenne</option>
                  <option>Élevée</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Latitude</label>
                  <input className="input" value={form.lat} onChange={(e) => setField("lat", e.target.value)} placeholder="optionnel si adresse" />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Longitude</label>
                  <input className="input" value={form.lng} onChange={(e) => setField("lng", e.target.value)} placeholder="optionnel si adresse" />
                </div>
              </div>

              <button type="button" className="button secondary" onClick={useMyLocation}>Utiliser mon GPS</button>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Commentaire</label>
                <textarea className="textarea" value={form.comment} onChange={(e) => setField("comment", e.target.value)} placeholder="Ex. Très profond, dangereux pour vélos et voitures." />
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 8, fontSize: 14 }}>Photo du nid-de-poule</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const reader = new FileReader();
                    reader.onload = () => {
                      setForm((prev) => ({
                        ...prev,
                        image: reader.result as string,
                      }));
                    };
                    reader.readAsDataURL(file);
                  }}
                />
              </div>

              <button className="button" type="submit">Enregistrer le signalement</button>
              {message ? <div className="note">{message}</div> : null}
            </form>
          </div>
        </section>

        <section className="grid grid-stats" style={{ marginTop: 24 }}>
          <StatCard label="Signalements actifs" value={stats.actifs} />
          <StatCard label="Villes suivies" value={stats.villes} />
          <StatCard label="Réparés" value={stats.repaired} />
          <StatCard label="Confirmations" value={stats.confirmations} />
        </section>

        <section className="card" style={{ marginTop: 24, padding: 24 }}>
          <div className="between">
            <div>
              <h2 style={{ margin: 0 }}>Filtres</h2>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                La carte et la liste se filtrent ensemble.
              </div>
            </div>

            <div className="row">
              <select className="select" value={filterCity} onChange={(e) => setFilterCity(e.target.value)}>
                {cities.map((city) => (<option key={city}>{city}</option>))}
              </select>

              <select className="select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option>Tous</option>
                <option>Nouveau</option>
                <option>Transmis</option>
                <option>Réparé</option>
              </select>

              <select className="select" value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)}>
                <option>Toutes</option>
                <option>Faible</option>
                <option>Moyenne</option>
                <option>Élevée</option>
              </select>
            </div>
          </div>
        </section>

        <section className="card" style={{ marginTop: 24, padding: 24 }}>
          <div className="between">
            <div>
              <h2 style={{ margin: 0 }}>Signalements</h2>
              <div className="muted" style={{ marginTop: 8, fontSize: 14 }}>
                Données stockées dans data/reports.json via backend local.
              </div>
            </div>
            <div className="note">{filteredReports.length} résultat{filteredReports.length > 1 ? "s" : ""}</div>
          </div>

          <div style={{ marginTop: 20, display: "grid", gap: 14 }}>
            {filteredReports.map((item) => (
              <div key={item.id} className={`list-item ${selectedId === item.id ? "selected" : ""}`}>
                <div className="between">
                  <div>
                    <div className="row" style={{ alignItems: "center" }}>
                      <span style={{ width: 12, height: 12, borderRadius: 999, display: "inline-block" }} className={getDotClass(item)} />
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{item.street}</div>
                    </div>
                    <div className="muted" style={{ marginTop: 6, fontSize: 14 }}>{item.city} · Signalé le {item.date}</div>
                    <div className="muted" style={{ marginTop: 4, fontSize: 12 }}>{formatCoord(item.lat)}, {formatCoord(item.lng)}</div>
                  </div>

                  <div className="row">
                    <span className={severityClass(item.severity)}>{item.severity}</span>
                    <span className={statusClass(item.status)}>{item.status}</span>
                  </div>
                </div>

                <div style={{ marginTop: 14, fontSize: 14, color: "#d4d4d8" }}>{item.comment}</div>

                {item.image && (
                  <img
                    src={item.image}
                    alt="nid-de-poule"
                    style={{
                      width: "100%",
                      maxHeight: 200,
                      objectFit: "cover",
                      borderRadius: 12,
                      marginTop: 10,
                    }}
                  />
                )}

                <div className="between" style={{ marginTop: 14 }}>
                  <div className="muted" style={{ fontSize: 14 }}>{item.confirmations} confirmations citoyennes</div>

                  <div className="row">
                    <button className="button secondary small" onClick={() => updateReport(item.id, "confirm")}>Confirmer</button>
                    <button className="button secondary small" onClick={() => updateReport(item.id, "send")}>Transmis ville</button>
                    <button className="button secondary small" onClick={() => updateReport(item.id, "repair")}>Marquer réparé</button>
                    <button className="button secondary small" onClick={() => setSelectedId(item.id)}>Voir sur carte</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-tests" style={{ marginTop: 24 }}>
          <TestCard title="Test 1 · Ajout manuel" text="Ajoute un signalement avec latitude et longitude. Il doit apparaître dans la liste et sur la carte." />
          <TestCard title="Test 2 · Géolocalisation" text="Clique sur Utiliser mon GPS. Les coordonnées doivent se remplir automatiquement." />
          <TestCard title="Test 3 · Géocodage" text="Entre Saint-Jérôme + Rue Saint-Georges sans latitude/longitude. La position doit être trouvée automatiquement au Québec." />
          <TestCard title="Test 4 · Clic carte + photo" text="Clique sur la carte pour remplir lat/lng puis ajoute une photo. Les deux doivent être enregistrés." />
        </section>
      </main>
    </div>
  );
}
