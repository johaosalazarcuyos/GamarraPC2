const request = require('supertest');
const { crearApp } = require('../src/app');

let app;
const comerciante = { dni: '12345678', nombre: 'Textiles Rosita', correo: 'rosita@mail.com', password: 'clave1234' };

async function loginToken() {
  await request(app).post('/api/registro').send(comerciante);
  const res = await request(app).post('/api/login').send({ dni: comerciante.dni, password: comerciante.password });
  return res.body.token;
}

beforeEach(() => { app = crearApp(); });

describe('E1 - Autenticación', () => {
  test('HU01: registra un comerciante con datos válidos', async () => {
    const res = await request(app).post('/api/registro').send(comerciante);
    expect(res.status).toBe(201);
    expect(res.body.rol).toBe('comerciante');
    expect(res.body.hash).toBeUndefined(); // nunca expone la contraseña
  });

  test('HU01: rechaza un DNI duplicado', async () => {
    await request(app).post('/api/registro').send(comerciante);
    const res = await request(app).post('/api/registro').send(comerciante);
    expect(res.status).toBe(409);
  });

  test('HU01: rechaza DNI inválido y contraseña corta', async () => {
    expect((await request(app).post('/api/registro').send({ ...comerciante, dni: '123' })).status).toBe(400);
    expect((await request(app).post('/api/registro').send({ ...comerciante, password: '123' })).status).toBe(400);
  });

  test('HU02: inicia sesión y devuelve un token', async () => {
    expect(await loginToken()).toBeTruthy();
  });

  test('HU02: rechaza credenciales incorrectas', async () => {
    await request(app).post('/api/registro').send(comerciante);
    const res = await request(app).post('/api/login').send({ dni: comerciante.dni, password: 'incorrecta' });
    expect(res.status).toBe(401);
  });
});

describe('Seguridad', () => {
  test('rutas protegidas rechazan peticiones sin token', async () => {
    expect((await request(app).post('/api/productos').send({ nombre: 'x', categoria: 'Jeans', precio: 10 })).status).toBe(401);
    expect((await request(app).get('/api/ventas/resumen')).status).toBe(401);
  });

  test('rechaza un token falsificado', async () => {
    const res = await request(app).get('/api/ventas/resumen').set('Authorization', 'Bearer token-falso');
    expect(res.status).toBe(401);
  });

  test('envía cabeceras de seguridad (Helmet)', async () => {
    const res = await request(app).get('/api/salud');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBeDefined();
  });
});

describe('E3 - Vitrina digital', () => {
  test('HU09 y HU10: publica productos y los filtra por categoría y precio', async () => {
    const token = await loginToken();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/productos').set(auth).send({ nombre: 'Jean clásico', categoria: 'Jeans', precio: 45, whatsapp: '987654321' });
    await request(app).post('/api/productos').set(auth).send({ nombre: 'Jean premium', categoria: 'Jeans', precio: 80 });
    await request(app).post('/api/productos').set(auth).send({ nombre: 'Polo básico', categoria: 'Polos', precio: 20 });

    const res = await request(app).get('/api/productos?categoria=Jeans&max=60');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].nombre).toBe('Jean clásico');
  });

  test('HU09: rechaza producto sin precio válido', async () => {
    const token = await loginToken();
    const res = await request(app).post('/api/productos').set('Authorization', `Bearer ${token}`).send({ nombre: 'Casaca', categoria: 'Casacas', precio: -5 });
    expect(res.status).toBe(400);
  });
});

describe('E4 - Control de ventas', () => {
  test('HU13 y HU14: registra ventas y alerta al superar el 80% del tope NRUS', async () => {
    const token = await loginToken();
    const auth = { Authorization: `Bearer ${token}` };
    await request(app).post('/api/ventas').set(auth).send({ monto: 3000 });
    let r = await request(app).get('/api/ventas/resumen').set(auth);
    expect(r.body.total).toBe(3000);
    expect(r.body.alerta).toBe(false);

    await request(app).post('/api/ventas').set(auth).send({ monto: 4000 });
    r = await request(app).get('/api/ventas/resumen').set(auth);
    expect(r.body.total).toBe(7000);
    expect(r.body.alerta).toBe(true);
  });

  test('HU13: rechaza montos inválidos', async () => {
    const token = await loginToken();
    const res = await request(app).post('/api/ventas').set('Authorization', `Bearer ${token}`).send({ monto: 0 });
    expect(res.status).toBe(400);
  });
});
