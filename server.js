const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const app = express();

/* =======================
   MIDDLEWARES
======================= */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* =======================
   BASE DE DATOS
======================= */
const DB = path.join(__dirname, "data.json");
if (!fs.existsSync(DB)) fs.writeFileSync(DB, "[]");

/* =======================
   USUARIO ÚNICO
======================= */
const USER = { user: "admin", pass: "1234" };

/* =======================
   RUTA PRINCIPAL
======================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

/* =======================
   LOGIN
======================= */
app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === USER.user && pass === USER.pass) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

/* =======================
   CREAR CUPÓN (CON RUT)
======================= */
app.post("/crear", async (req, res) => {
  const { telefono, rut } = req.body;

  if (!telefono || !rut) {
    return res.status(400).json({ error: "Teléfono y RUT requeridos" });
  }

  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));

  const id = uuidv4();
  const fecha = new Date().toISOString().slice(0, 10);
  const url = `${req.protocol}://${req.get("host")}/cupon/${id}`;
  const qr = await QRCode.toDataURL(url);

  const cupon = {
    id,
    telefono,
    rut,           // ✅ RUT guardado
    fecha,
    usado: false,
    usadoEn: null,
    qr
  };

  cupones.push(cupon);
  fs.writeFileSync(DB, JSON.stringify(cupones, null, 2));

  res.json(cupon);
});

/* =======================
   VER CUPÓN
======================= */
app.get("/cupon/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cupon.html"));
});

/* =======================
   CANJEAR CUPÓN
======================= */
app.post("/canjear/:id", (req, res) => {
  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));
  const cupon = cupones.find(c => c.id === req.params.id);

  if (!cupon) return res.status(404).json({ error: "No existe" });
  if (cupon.usado) return res.status(400).json({ error: "Ya usado" });

  const hoy = new Date().toISOString().slice(0, 10);
  if (cupon.fecha !== hoy) {
    return res.status(400).json({ error: "Cupón vencido" });
  }

  cupon.usado = true;
  cupon.usadoEn = new Date().toISOString();

  fs.writeFileSync(DB, JSON.stringify(cupones, null, 2));
  res.json({ ok: true });
});

/* =======================
   STATS
======================= */
app.get("/stats", (req, res) => {
  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));
  const hoy = new Date().toISOString().slice(0, 10);

  res.json({
    total: cupones.length,
    usados: cupones.filter(c => c.usado).length,
    hoy: cupones.filter(c => c.fecha === hoy).length,
    usadosHoy: cupones.filter(c => c.usado && c.fecha === hoy).length
  });
});

/* =======================
   EXPORTAR
======================= */
app.get("/exportar", (req, res) => {
  res.download(DB, "reporte-cupones.json");
});

/* =======================
   PUERTO (RENDER)
======================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✔ Servidor activo en puerto", PORT);
});

