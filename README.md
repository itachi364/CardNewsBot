# CardNewsBot

Bot de Discord para publicar noticias de **Yu-Gi-Oh!** y **Pokémon** en un canal específico, mencionando a la comunidad y notificando a administradores cuando una fuente falla o parece bloqueada.

El bot está pensado para ejecutarse gratis en la misma EC2 donde ya corren otros bots con PM2.

## Fuentes configuradas

- Yu-Gi-Oh!: `https://www.yugioh-card.com/eu/es/noticias/`
- Pokémon: `https://www.pokemon.com/el/noticias-pokemon`

## Características

- Consulta múltiples fuentes de noticias.
- Si una fuente falla, la otra se sigue intentando.
- Publica noticias nuevas en un canal de Discord.
- Puede mencionar `@everyone`, un rol específico o nadie.
- Guarda noticias enviadas en `sent-news.json` para evitar duplicados.
- Detecta bloqueos probables como HTTP 403, HTTP 429, Incapsula, captcha o Access Denied.
- Notifica errores importantes en un canal privado de administración.
- Menciona a un rol de administradores cuando hay un bloqueo o fallo de fuente.
- Usa cooldown para no spamear a administradores si una fuente sigue fallando.
- Logs mínimos para no llenar almacenamiento en EC2.

## Stack

- Node.js 20+
- discord.js
- cheerio
- undici
- dotenv
- PM2 para producción

## Instalación local

```bash
git clone https://github.com/itachi364/CardNewsBot.git
cd CardNewsBot
npm install
cp .env.example .env
```

Edita `.env` con tus valores reales.

```bash
npm start
```

## Variables de entorno

```env
DISCORD_TOKEN=PUT_YOUR_BOT_TOKEN_HERE
NEWS_CHANNEL_ID=PUT_NEWS_CHANNEL_ID_HERE
ADMIN_LOG_CHANNEL_ID=PUT_ADMIN_LOG_CHANNEL_ID_HERE
ADMIN_ROLE_ID=PUT_ADMIN_ROLE_ID_HERE

MENTION_MODE=everyone
NEWS_ROLE_ID=

POLL_INTERVAL_MINUTES=60
ADMIN_ALERT_COOLDOWN_MINUTES=360
MAX_NEWS_PER_SOURCE=3

YUGIOH_NEWS_URL=https://www.yugioh-card.com/eu/es/noticias/
POKEMON_NEWS_URL=https://www.pokemon.com/el/noticias-pokemon

SENT_NEWS_FILE=sent-news.json
HTTP_TIMEOUT_MS=15000
```

### MENTION_MODE

Valores permitidos:

- `everyone`: menciona `@everyone` en cada noticia.
- `role`: menciona el rol configurado en `NEWS_ROLE_ID`.
- `none`: no menciona a nadie.

## Permisos del bot en Discord

En el canal de noticias:

- Ver canal
- Enviar mensajes
- Insertar enlaces
- Enviar embeds
- Leer historial
- Mencionar `@everyone` si `MENTION_MODE=everyone`

En el canal de logs/admin:

- Ver canal
- Enviar mensajes
- Insertar enlaces
- Enviar embeds
- Leer historial
- Mencionar el rol configurado en `ADMIN_ROLE_ID`

## Comportamiento operativo

En cada ciclo:

1. Intenta consultar Yu-Gi-Oh!.
2. Publica noticias nuevas si existen.
3. Si Yu-Gi-Oh! falla, registra error y avisa a admins.
4. Continúa con Pokémon sin detener el bot.
5. Publica noticias nuevas si existen.
6. Si Pokémon falla, registra error y avisa a admins.
7. Espera el siguiente ciclo.

Una fuente caída no detiene el resto del procesamiento.

## Primera ejecución

En el primer ciclo, el bot marca como enviadas las noticias existentes para evitar publicar muchas noticias antiguas de golpe.

Después de ese primer ciclo, solo publicará noticias nuevas.

## Despliegue con PM2 en EC2

```bash
cd ~/discord-bots
git clone https://github.com/itachi364/CardNewsBot.git
cd CardNewsBot
npm install
nano .env
pm2 start npm --name CardNewsBot -- start
pm2 save
```

Ver logs:

```bash
pm2 logs CardNewsBot
```

Reiniciar:

```bash
pm2 restart CardNewsBot --update-env
```

Limpiar logs:

```bash
pm2 flush CardNewsBot
```

## Estructura

```text
src/
 ├── index.js
 ├── config.js
 ├── discord/
 │    ├── adminNotifier.js
 │    └── newsPublisher.js
 ├── sources/
 │    ├── pokemonSource.js
 │    └── yugiohSource.js
 ├── storage/
 │    └── sentNewsStore.js
 └── utils/
      ├── errorClassifier.js
      └── httpClient.js
```

## Notas sobre Pokémon

`pokemon.com` puede bloquear requests automatizados con mecanismos anti-bot. El bot clasifica esos casos como `BLOCKED`, registra el error en PM2 y notifica al canal admin sin detener el procesamiento de Yu-Gi-Oh!.

## Seguridad

No subir `.env` ni tokens al repositorio.

El archivo `sent-news.json` también queda fuera de Git porque es estado local del runtime.
