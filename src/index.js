import 'dotenv/config';
import { createApp } from './app.js';
import { createConfig } from './config.js';
import { createStore } from './store.js';

const config = createConfig();
const app = createApp({ config, store: createStore(config) });

app.listen(config.port, '0.0.0.0', () => {
  console.log(`Reviewer banking API listening on ${config.port}`);
});
