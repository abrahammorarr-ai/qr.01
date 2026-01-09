const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

const app = express();

/* ========= MIDDLEWARES ========= */
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

/* ========= BASE DE DATOS ========= */
const DB = path.join(__dirname, "data.json");
if (!fs.existsSync(DB)) fs.writeFileSync(DB, "[]");

/* ========= LOGIN SIMPLE ========= */
const USER = { user: "admin", pass: "1234" };

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "login.html"));
});

app.post("/login", (req, res) => {
  const { user, pass } = req.body;
  if (user === USER.user && pass === USER.pass) {
    return res.json({ ok: true });
  }
  res.status(401).json({ ok: false });
});

/* ========= CREAR CUPÓN ========= */
app.post("/crear", async (req, res) => {
  const { telefono, rut } = req.body;

  // 🔹 SOLO EXIGE QUE AL MENOS UNO EXISTA
  if (!telefono && !rut) {
    return res.status(400).json({
      error: "Debe ingresar RUT o teléfono"
    });
  }

  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));

  const id = uuidv4();
  const fecha = new Date().toISOString().slice(0, 10);
  const url = `${req.protocol}://${req.get("host")}/cupon/${id}`;
  const qr = await QRCode.toDataURL(url);

  const cupon = {
    id,
    telefono: telefono || null,
    rut: rut || null,
    fecha,
    usado: false,
    usadoEn: null,
    qr
  };

  cupones.push(cupon);
  fs.writeFileSync(DB, JSON.stringify(cupones, null, 2));

  res.json(cupon);
});

/* ========= VER CUPÓN ========= */
app.get("/cupon/:id", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "cupon.html"));
});

/* ========= CANJEAR CUPÓN ========= */
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

/* ========= BUSCAR POR RUT O TELÉFONO ========= */
/* 👇 ESTO ES LO QUE ME PREGUNTASTE "DÓNDE CAMBIO" */
app.get("/buscar/:valor", (req, res) => {
  const valor = req.params.valor;
  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));

  const lista = cupones.filter(c =>
    c.rut === valor || c.telefono === valor
  );

  res.json(lista);
});

/* ========= ELIMINAR CUPÓN ========= */
app.delete("/eliminar/:id", (req, res) => {
  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));
  const index = cupones.findIndex(c => c.id === req.params.id);

  if (index === -1) {
    return res.status(404).json({ error: "Cupón no existe" });
  }

  const eliminado = cupones.splice(index, 1)[0];
  fs.writeFileSync(DB, JSON.stringify(cupones, null, 2));

  res.json({ ok: true, eliminado });
});

/* ========= STATS (NO SE BORRA) ========= */
app.get("/stats", (req, res) => {
  const cupones = JSON.parse(fs.readFileSync(DB, "utf8"));
  const hoy = new Date().toISOString().slice(0, 10);

  res.json({
    total: cupones.length,
    hoy: cupones.filter(c => c.fecha === hoy).length,
    usadosHoy: cupones.filter(c => c.usado && c.fecha === hoy).length
  });
});

/* ========= PUERTO ========= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("✔ Servidor activo en puerto", PORT);
});


