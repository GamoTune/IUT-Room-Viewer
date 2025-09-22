module.exports = {
  apps: [
    {
      name: 'IUT-Room-Viewer DB',
      cwd: '/programs/iut-room-viewer',
      script: './server/app.js',
      watch: true,
      autorestart: true,        // relance automatiquement si crash
      restart_delay: 5000,
    },
    {
      name: 'IUT-Room-Viewer Bot',
      cwd: '/programs/iut-room-viewer',
      script: './bot/index.js',
      watch: true,
      autorestart: true,        // relance automatiquement si crash
      restart_delay: 5000,
    }]
};
