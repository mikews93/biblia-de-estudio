// La configuración está en app.json. Aquí solo se añade lo que llega de EAS al compilar: el google-services.json
// de Firebase (variable de tipo archivo GOOGLE_SERVICES_JSON en expo.dev), que las notificaciones de Android
// necesitan y que no se guarda en el repositorio.
module.exports = ({ config }) => ({
  ...config,
  android: {
    ...config.android,
    ...(process.env.GOOGLE_SERVICES_JSON ? { googleServicesFile: process.env.GOOGLE_SERVICES_JSON } : {}),
  },
});
