// Configuración PM2: pm2 start deploy/ecosystem.config.js
module.exports = {
  apps: [{
    name: 'alcanos-iupac',
    script: 'server.js',
    cwd: __dirname + '/..',
    instances: 1,
    autorestart: true,
    max_memory_restart: '200M',
    env: { NODE_ENV: 'production', PORT: 3010, HOST: '127.0.0.1' },
  }],
};
