'use strict';
let token = sessionStorage.getItem('token');
let nombre = sessionStorage.getItem('nombre');
const $ = (id) => document.getElementById(id);

function mensaje(txt, error) {
  $('mensaje').textContent = txt;
  $('mensaje').style.color = error ? '#b91c1c' : '#15803d';
}

async function api(url, opciones = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(url, { ...opciones, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error inesperado');
  return data;
}

const datos = (form) => Object.fromEntries(new FormData(form).entries());

// Crea elementos con textContent (evita inyección de HTML / XSS)
function el(tag, texto, clase) {
  const e = document.createElement(tag);
  if (texto !== undefined) e.textContent = texto;
  if (clase) e.className = clase;
  return e;
}

async function cargarCatalogo() {
  const params = new URLSearchParams();
  if ($('f-categoria').value) params.set('categoria', $('f-categoria').value);
  if ($('f-max').value) params.set('max', $('f-max').value);
  const productos = await api('/api/productos?' + params);
  const cont = $('catalogo');
  cont.replaceChildren();
  if (!productos.length) cont.append(el('p', 'No hay productos publicados todavía.'));
  productos.forEach((p) => {
    const card = el('div', undefined, 'card');
    card.append(el('h4', p.nombre), el('div', 'S/ ' + p.precio.toFixed(2), 'precio'),
      el('small', p.categoria + (p.tallas ? ' · Tallas: ' + p.tallas : '')), el('p', 'Vende: ' + p.comerciante));
    if (p.whatsapp) {
      const a = el('a', 'Contactar por WhatsApp');
      a.href = 'https://wa.me/51' + p.whatsapp + '?text=' + encodeURIComponent('Hola, me interesa: ' + p.nombre);
      a.target = '_blank';
      a.rel = 'noopener';
      card.append(a);
    }
    cont.append(card);
  });
}

async function cargarResumen() {
  const r = await api('/api/ventas/resumen');
  const box = $('resumen');
  box.className = 'resumen' + (r.alerta ? ' alerta' : '');
  box.textContent = `Ventas del mes (${r.mes}): S/ ${r.total.toFixed(2)} — ${r.porcentaje}% del tope NRUS (S/ ${r.tope}).` +
    (r.alerta ? ' ⚠ Estás cerca del tope de tu categoría NRUS.' : '');
}

function mostrarSesion() {
  const logueado = Boolean(token);
  $('panel').hidden = !logueado;
  $('acceso').hidden = logueado;
  $('sesion').textContent = logueado ? 'Sesión: ' + nombre : '';
  if (logueado) cargarResumen().catch(() => {});
}

$('form-buscar').addEventListener('submit', (e) => { e.preventDefault(); cargarCatalogo().catch((err) => mensaje(err.message, true)); });

$('form-registro').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/api/registro', { method: 'POST', body: JSON.stringify(datos(e.target)) }); e.target.reset(); mensaje('Cuenta creada. Ahora inicia sesión.'); }
  catch (err) { mensaje(err.message, true); }
});

$('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    const r = await api('/api/login', { method: 'POST', body: JSON.stringify(datos(e.target)) });
    token = r.token; nombre = r.nombre;
    sessionStorage.setItem('token', token); sessionStorage.setItem('nombre', nombre);
    e.target.reset(); mensaje('Bienvenido, ' + nombre); mostrarSesion();
  } catch (err) { mensaje(err.message, true); }
});

$('form-producto').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/api/productos', { method: 'POST', body: JSON.stringify(datos(e.target)) }); e.target.reset(); mensaje('Producto publicado'); cargarCatalogo(); }
  catch (err) { mensaje(err.message, true); }
});

$('form-venta').addEventListener('submit', async (e) => {
  e.preventDefault();
  try { await api('/api/ventas', { method: 'POST', body: JSON.stringify(datos(e.target)) }); e.target.reset(); mensaje('Venta registrada'); cargarResumen(); }
  catch (err) { mensaje(err.message, true); }
});

$('salir').addEventListener('click', () => { token = null; sessionStorage.clear(); mostrarSesion(); mensaje('Sesión cerrada'); });

mostrarSesion();
cargarCatalogo().catch(() => {});
