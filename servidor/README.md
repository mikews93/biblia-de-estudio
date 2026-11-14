# Ronda de avisos en Cloud Run

`servidor/avisos.ts` sirve la ronda de avisos de `api/notificaciones.ts` (recordatorio diario, despertador,
«10 minutos más» y racha) desde Cloud Run. Cloud Scheduler la llama cada minuto.

**Por qué no en Vercel.** El despertador necesita una ronda por minuto: unas 1.440 llamadas al día. En el plan gratis
de Vercel esas llamadas gastaban buena parte de las 4 h de CPU de los últimos 30 días, y si se pasan Vercel pausa todos
los proyectos del equipo. En Cloud Run esa cantidad cabe en la capa gratis.

**Qué sigue en Vercel.** Todo lo que piden las personas (`guardar`, `leer`, `estado`, `posponer`, `quitar`,
`probar`) sigue en `/api/notificaciones`. Las dos partes usan la misma base y la misma tabla `ajustes`. Si las dos
llamaran a la vez, la ronda no se repite: el candado `ultimo_envio` deja pasar solo una cada 50 s.

**Seguridad.** El servicio no admite llamadas anónimas. Solo entra la cuenta `zarza-avisos-programador` de Cloud
Scheduler, con un token OIDC. La base va en Secret Manager (`zarza-database-url`), nunca en el repo.

**Desplegar.**

```sh
# Primera vez: con la DATABASE_URL de producción de Zarza (Vercel → biblia-de-estudio → Settings → Environment Variables)
PROYECTO=<id del proyecto de Zarza> DATABASE_URL='postgres://…' sh servidor/desplegar.sh
# Las siguientes veces
PROYECTO=<id del proyecto de Zarza> sh servidor/desplegar.sh
```

Después de la primera vez, apaga en cron-job.org la tarea que llamaba a
`/api/notificaciones?accion=enviar`. Para volver atrás, enciéndela otra vez y pausa la tarea
`zarza-avisos` de Cloud Scheduler.
