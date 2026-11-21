const { crearApp } = require('./app');

const PORT = process.env.PORT || 3000;
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET');
  process.exit(1);
}
crearApp().listen(PORT, () => console.log(`Gamarra Conecta escuchando en el puerto ${PORT}`));
