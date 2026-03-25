import { promises as fs } from "fs";
import path from "path";

const filePath = path.join(process.cwd(), "data", "reports.json");

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

const seed: Report[] = [
  {
    id: 1,
    city: "Montréal",
    street: "Rue Saint-Denis / Sherbrooke",
    severity: "Élevée",
    status: "Nouveau",
    date: "2026-03-20",
    confirmations: 12,
    comment: "Trou profond, dangereux pour vélos et petites voitures.",
    lat: 45.5142,
    lng: -73.5746,
    image: "",
  },
  {
    id: 2,
    city: "Québec",
    street: "Boulevard Charest",
    severity: "Moyenne",
    status: "Transmis",
    date: "2026-03-18",
    confirmations: 7,
    comment: "Visible depuis plusieurs jours, trafic dense.",
    lat: 46.8139,
    lng: -71.2363,
    image: "",
  },
  {
    id: 3,
    city: "Laval",
    street: "Autoroute 15, sortie locale",
    severity: "Faible",
    status: "Réparé",
    date: "2026-03-15",
    confirmations: 4,
    comment: "Réparation récente, à surveiller.",
    lat: 45.569,
    lng: -73.7243,
    image: "",
  },
];

async function ensureFile() {
  try {
    await fs.access(filePath);
  } catch {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(seed, null, 2), "utf8");
  }
}

async function readReports(): Promise<Report[]> {
  await ensureFile();
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeReports(reports: Report[]) {
  await fs.writeFile(filePath, JSON.stringify(reports, null, 2), "utf8");
}

export async function GET() {
  return Response.json(await readReports());
}

export async function POST(req: Request) {
  const reports = await readReports();
  const body = await req.json();

  const lat = Number(body.lat);
  const lng = Number(body.lng);

  if (!body.city || !body.street) {
    return Response.json(
      { error: "Ville et emplacement requis." },
      { status: 400 }
    );
  }

  if (
    !Number.isFinite(lat) ||
    lat < -90 ||
    lat > 90 ||
    !Number.isFinite(lng) ||
    lng < -180 ||
    lng > 180
  ) {
    return Response.json(
      { error: "Coordonnées invalides." },
      { status: 400 }
    );
  }

  const duplicate = reports.find(
    (item) =>
      Math.abs(item.lat - lat) < 0.0015 &&
      Math.abs(item.lng - lng) < 0.0015 &&
      item.status !== "Réparé"
  );

  if (duplicate) {
    return Response.json(
      { error: "Un signalement proche existe déjà.", id: duplicate.id },
      { status: 409 }
    );
  }

  const newItem: Report = {
    id: Date.now(),
    city: String(body.city).trim(),
    street: String(body.street).trim(),
    severity:
      body.severity === "Élevée" || body.severity === "Faible"
        ? body.severity
        : "Moyenne",
    status: "Nouveau",
    date: new Date().toISOString().slice(0, 10),
    confirmations: 1,
    comment: String(body.comment || "").trim() || "Aucun commentaire.",
    lat,
    lng,
    image: String(body.image || ""),
  };

  await writeReports([newItem, ...reports]);
  return Response.json(newItem, { status: 201 });
}

export async function PATCH(req: Request) {
  const reports = await readReports();
  const body = await req.json();

  const id = Number(body.id);
  const action = body.action;

  const next = reports.map((item) => {
    if (item.id !== id) return item;
    if (action === "confirm") {
      return { ...item, confirmations: item.confirmations + 1 };
    }
    if (action === "send") {
      return { ...item, status: "Transmis" as const };
    }
    if (action === "repair") {
      return { ...item, status: "Réparé" as const };
    }
    return item;
  });

  await writeReports(next);
  return Response.json({ ok: true });
}

export async function DELETE() {
  await writeReports(seed);
  return Response.json({ ok: true });
}
