import DHT from "bittorrent-dht";

let _dht = null;
let _ready = false;
function getDHT() {
  if (_dht && _ready) return _dht;
  _dht = new DHT({ bootstrap: true });
  _dht.listen(0, () => { _ready = true; });
  _dht.on("error", () => {});
  return _dht;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(200).end();

  const dht = getDHT();

  if (req.method === "GET" && req.url === "/health") {
    return res.json({ ok: _ready, nodes: dht.nodes?.length || 0 });
  }

  if (req.method === "POST" && req.url === "/put") {
    const { data } = req.body || {};
    if (!data) return res.status(400).json({ error: "missing data" });
    try {
      const buf = Buffer.from(data, "base64");
      const infoHash = await dht.put({ v: buf });
      return res.json({ infoHash: Buffer.from(infoHash).toString("hex") });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method === "POST" && req.url === "/get") {
    const { infoHash } = req.body || {};
    if (!infoHash) return res.status(400).json({ error: "missing infoHash" });
    try {
      const result = await dht.get(Buffer.from(infoHash, "hex"));
      if (!result || !result.v) return res.status(404).json({ error: "not found" });
      return res.json({ data: Buffer.from(result.v).toString("base64") });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(404).json({ error: "not found" });
}