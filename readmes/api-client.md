# @dak/api-client

Auto-generated TypeScript client for the home-relay Python API.

## Generation

```bash
pnpm gen:api
```

This runs:

1. `home-relay/export_openapi.py` to generate `openapi.json`
2. `@hey-api/openapi-ts` to generate TypeScript client

Generated code lives in `src/generated/` - do not edit manually.

## Available Endpoints

- `/kasa/*` - Kasa device control
- `/sensors/all` - Climate sensor data
- `/config/*` - Dashboard configuration
- `/voices` - TTS voice models
- `/voice/*` - Voice control and transcription
- `/wol/*` - Wake-on-LAN
- `/brightness/*` - Display brightness
- `/mqtt/*` - MQTT messages
- `/adguard/*` - AdGuard stats

## Usage

```ts
import { getDevices, toggleDevice } from '@dak/api-client';

const devices = await getDevices();
await toggleDevice({ deviceId: 'living-room-lamp' });
```
