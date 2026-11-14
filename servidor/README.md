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
# Primera vez: con la cadena pooled de Neon de Zarza (Neon → neon-gray-bell → Connect → Connection pooling).
# No sirve `vercel env pull`: en Vercel la variable es «sensible» y llega como el texto [SENSITIVE].
PROYECTO=zarza-512819 DATABASE_URL='postgresql://…-pooler…' sh servidor/desplegar.sh
# Las siguientes veces
PROYECTO=zarza-512819 sh servidor/desplegar.sh
```

Después de la primera vez, apaga en cron-job.org la tarea que llamaba a
`/api/notificaciones?accion=enviar`. Para volver atrás, enciéndela otra vez y pausa la tarea
`zarza-avisos` de Cloud Scheduler.

**En producción (2026-11-14).** Proyecto `zarza-512819`, región `us-east4`, servicio `zarza-avisos`, tarea de
Scheduler `zarza-avisos` cada minuto. El primer despliegue necesitó dar `roles/run.builder` a la cuenta de Compute
del proyecto (los proyectos nuevos no la traen con permiso para construir).
