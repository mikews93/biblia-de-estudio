#!/bin/sh
# ignoreCommand de Vercel: con salida 0 Vercel salta el despliegue, con 1 lo hace.
# Para no gastar el límite diario de despliegues (Hobby: 100), solo se despliegan main
# (producción) y dev, la rama donde se integran los PR aprobados antes de publicarlos;
# los hilos enseñan capturas. Otra rama de integración se añade a RAMAS o se llama integracion/<algo>.
RAMAS="main dev"

rama="$VERCEL_GIT_COMMIT_REF"
# Sin rama de git (despliegue a mano con la CLI): se despliega.
[ -z "$rama" ] && exit 1
for r in $RAMAS; do
  [ "$rama" = "$r" ] && exit 1
done
case "$rama" in
  integracion/*) exit 1 ;;
esac
echo "Vista previa omitida para $rama: solo se despliegan main y dev."
exit 0
