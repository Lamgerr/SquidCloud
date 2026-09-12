import DHT from "bittorrent-dht";
import express from "express";
import cors from "cors";
import crypto from "crypto";

const PORT = parseInt(process.env.PORT || "3927");
const API_KEY = process.env.API_KEY || ""; // optional auth
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").filter(Boolean);

const app = express();
app.use(express.json({ limit: "2mb" }));
app.use(cors({
  origin: ALLOWED_ORIGINS.length > 0 ? ALLOWED_ORIGINS : true,
  methods: ["GET", "POST"],
}));

// ── DHT Node ──────────────────────────────────────────────
const dht = new DHT({ bootstrap: true });
let dhtReady = false;

dht.listen(0, () => {
  const addr = dht.address();
  console.log(`[DHT] BitTorrent DHT listening on UDP :${addr.port}`);
  dhtReady = true;
});

dht.on("ready", () => console.log("[DHT] Connected to BitTorrent DHT network"));
dht.on("error", (err) => console.error("[DHT] Error:", err));

// ── Auth middleware (optional) ─────────────────────────────
function auth(req, res, next) {
  if (!API_KEY) return next();
  const key = req.headers["x-api-key"] || req.query.key;
  if (key !== API_KEY) return res.status(401).json({ error: "unauthorized" });
  next();
}

// ── Health ────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: dhtReady, nodes: dht.nodes?.length || 0 });
});

// ── PUT: Store data on DHT ────────────────────────────────
// Body: { data: "<base64>" }
// Returns: { infoHash: "<hex>" }
app.post("/put", auth, async (req, res) => {
  if (!dhtReady) return res.status(503).json({ error: "DHT not ready" });

  try {
    const { data } = req.body;
    if (!data) return res.status(400).json({ error: "missing data" });

    const buf = Buffer.from(data, "base64");

    // BEP44 immutable item — infoHash = SHA-1(bencode({v: buf}))
    const infoHash = await dht.put({ v: buf });

    const hex = Buffer.from(infoHash).toString("hex");
    console.log(`[DHT] PUT ${hex.slice(0, 16)}... (${buf.length} bytes)`);
    res.json({ infoHash: hex });
  } catch (err) {
    console.error("[DHT] PUT error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET: Retrieve data from DHT ───────────────────────────
// Body: { infoHash: "<hex>" }
// Returns: { data: "<base64>" }
app.post("/get", auth, async (req, res) => {
  if (!dhtReady) return res.status(503).json({ error: "DHT not ready" });

  try {
    const { infoHash } = req.body;
    if (!infoHash) return res.status(400).json({ error: "missing infoHash" });

    const ihBuf = Buffer.from(infoHash, "hex");
    const result = await dht.get(ihBuf);

    if (!result || !result.v) {
      return res.status(404).json({ error: "not found" });
    }

    const hex = Buffer.from(ihBuf).toString("hex");
    console.log(`[DHT] GET ${hex.slice(0, 16)}... → ${result.v.length} bytes`);
    res.json({ data: Buffer.from(result.v).toString("base64") });
  } catch (err) {
    console.error("[DHT] GET error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[DHT] Relay server on http://0.0.0.0:${PORT}`);
});
