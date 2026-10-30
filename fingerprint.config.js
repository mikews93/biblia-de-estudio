/**
 * Huella nativa de la app (runtimeVersion «fingerprint» en app.json): decide a qué APK o app de tienda le llega cada
 * actualización publicada con EAS Update. Es el preset «balanced» de Expo más ExpoConfigExtraSection, porque
 * app.config.ts escribe en extra el commit y la fecha de compilación: si contaran, la huella cambiaría en cada commit
 * y ninguna actualización encontraría su app.
 * @type {import('expo/fingerprint').Config}
 */
module.exports = {
  sourceSkips: [
    'PackageJsonAndroidAndIosScriptsIfNotContainRun',
    'ExpoConfigVersions',
    'ExpoConfigRuntimeVersionIfString',
    'EasJson',
    'Easignore',
    'AutolinkingConfigPaths',
    'ExpoConfigExtraSection',
  ],
};
