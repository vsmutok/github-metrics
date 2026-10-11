import app from './app.js';
import config from './config/index.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  if (!config.isProduction) {
    console.log(`Server running on http://localhost:${PORT}`);
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a different value in .env`);
    process.exit(1);
  }
  throw err;
});
