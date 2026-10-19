#!/bin/sh
# ignoreCommand de Vercel: con salida 0 Vercel salta el despliegue, con 1 lo hace.
# Para no gastar el límite diario de despliegues (Hobby: 100), solo se despliegan main
# y las ramas de integración que juntan los PR terminados; los hilos enseñan capturas.
# Una rama de integración nueva se añade a RAMAS o se llama integracion/<algo>.
RAMAS="main claude/project-thread-7oc9uz"

rama="$VERCEL_GIT_COMMIT_REF"
# Sin rama de git (despliegue a mano con la CLI): se despliega.
[ -z "$rama" ] && exit 1
for r in $RAMAS; do
  [ "$rama" = "$r" ] && exit 1
done
case "$rama" in
  integracion/*) exit 1 ;;
esac
echo "Vista previa omitida para $rama: solo se despliegan main y las ramas de integración."
exit 0
