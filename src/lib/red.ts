// Si el teléfono tiene internet (red.native.ts, con expo-network). En la web lo dice el navegador: ver conexion.ts.

export const nativeOnline = () => true;

export const onNativeChange = (_listener: () => void) => () => {};
