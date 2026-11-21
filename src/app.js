// Gamarra Conecta - API y servidor de la página web
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');

// Tope mensual de ingresos del NRUS (categoría 2). Configurable por variable de entorno.
const TOPE_NRUS = Number(process.env.TOPE_NRUS || 8000);

function crearApp() {
  const JWT_SECRET = process.env.JWT_SECRET || 'solo-para-desarrollo';
  const app = express();

  // Datos en memoria (MVP de clase: se reinician al reiniciar el servidor)
  const db = { usuarios: [], productos: [], ventas: [] };

  // ---- Seguridad de la aplicación ----
  app.use(helmet()); // cabeceras HTTP seguras
  app.use(express.json({ limit: '10kb' })); // evita cuerpos gigantes
  app.use(express.static(path.join(__dirname, '..', 'public')));

  // Limita intentos de login/registro (protección contra fuerza bruta)
  const limiteAuth = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });

  function autenticar(req, res, next) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Token requerido' });
    try {
      req.usuario = jwt.verify(token, JWT_SECRET);
      return next();
    } catch {
      return res.status(401).json({ error: 'Token inválido o expirado' });
    }
  }

  const texto = (v, max = 100) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;

  // ---- E1: Autenticación ----
  app.post('/api/registro', limiteAuth, async (req, res) => {
    const { dni, nombre, correo, password } = req.body || {};
    if (!/^\d{8}$/.test(String(dni || ''))) return res.status(400).json({ error: 'El DNI debe tener 8 dígitos' });
    if (!texto(nombre) || !texto(correo) || !/^\S+@\S+\.\S+$/.test(correo)) {
      return res.status(400).json({ error: 'Nombre o correo inválido' });
    }
    if (typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    if (db.usuarios.some((u) => u.dni === dni)) return res.status(409).json({ error: 'El DNI ya está registrado' });

    const hash = await bcrypt.hash(password, 10); // nunca se guarda la contraseña en texto plano
    const usuario = { id: db.usuarios.length + 1, dni, nombre: nombre.trim(), correo: correo.trim(), hash, rol: 'comerciante' };
    db.usuarios.push(usuario);
    return res.status(201).json({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol });
  });

  app.post('/api/login', limiteAuth, async (req, res) => {
    const { dni, password } = req.body || {};
    const usuario = db.usuarios.find((u) => u.dni === String(dni || ''));
    const ok = usuario && typeof password === 'string' && (await bcrypt.compare(password, usuario.hash));
    if (!ok) return res.status(401).json({ error: 'Usuario o contraseña inválidos' });
    const token = jwt.sign({ id: usuario.id, nombre: usuario.nombre, rol: usuario.rol }, JWT_SECRET, { expiresIn: '2h' });
    return res.json({ token, nombre: usuario.nombre, rol: usuario.rol });
  });

  // ---- E3: Vitrina digital ----
  app.get('/api/productos', (req, res) => {
    const categoria = req.query.categoria ? String(req.query.categoria).toLowerCase() : null;
    const max = req.query.max ? Number(req.query.max) : null;
    const lista = db.productos.filter(
      (p) => (!categoria || p.categoria.toLowerCase() === categoria) && (!max || p.precio <= max)
    );
    res.json(lista);
  });

  app.post('/api/productos', autenticar, (req, res) => {
    const { nombre, categoria, precio, tallas, whatsapp } = req.body || {};
    const p = Number(precio);
    if (!texto(nombre) || !texto(categoria, 40) || !(p > 0)) {
      return res.status(400).json({ error: 'Nombre, categoría y precio (> 0) son obligatorios' });
    }
    if (whatsapp && !/^9\d{8}$/.test(String(whatsapp))) {
      return res.status(400).json({ error: 'WhatsApp debe ser un celular peruano de 9 dígitos' });
    }
    const producto = {
      id: db.productos.length + 1,
      nombre: nombre.trim(),
      categoria: categoria.trim(),
      precio: p,
      tallas: texto(tallas, 40) ? tallas.trim() : '',
      whatsapp: whatsapp ? String(whatsapp) : '',
      comerciante: req.usuario.nombre,
      comercianteId: req.usuario.id,
    };
    db.productos.push(producto);
    return res.status(201).json(producto);
  });

  // ---- E4: Control de ventas ----
  app.post('/api/ventas', autenticar, (req, res) => {
    const monto = Number((req.body || {}).monto);
    if (!(monto > 0)) return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    const venta = { id: db.ventas.length + 1, monto, fecha: new Date().toISOString(), comercianteId: req.usuario.id };
    db.ventas.push(venta);
    return res.status(201).json(venta);
  });

  app.get('/api/ventas/resumen', autenticar, (req, res) => {
    const mes = new Date().toISOString().slice(0, 7);
    const total = db.ventas
      .filter((v) => v.comercianteId === req.usuario.id && v.fecha.startsWith(mes))
      .reduce((s, v) => s + v.monto, 0);
    const porcentaje = Math.round((total / TOPE_NRUS) * 100);
    res.json({ mes, total, tope: TOPE_NRUS, porcentaje, alerta: porcentaje >= 80 });
  });

  app.get('/api/salud', (req, res) => res.json({ estado: 'ok' }));

  return app;
}

module.exports = { crearApp, TOPE_NRUS };
