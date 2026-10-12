import { createApp } from './app';
import { loadConfig } from './config';
import { Store } from './store';

const config = loadConfig();
createApp(config, new Store(config.dataFile)).listen(config.port, () =>
  console.log(`Filing service on http://localhost:${config.port} (live filing ${config.allowLive ? 'ENABLED' : 'disabled'})`),
);
