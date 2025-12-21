module.exports = {
  apps: [
    {
      name: 'IUT-Room-Viewer API',
      cwd: '/programs/iut-room-viewer/server',
      script: 'src/index.ts',
      interpreter: 'bun',
      watch: true,
      autorestart: true,
      restart_delay: 5000,
    },
    {
      name: 'IUT-Room-Viewer Bot',
      cwd: '/programs/iut-room-viewer/bot',
      script: 'src/index.ts',
      interpreter: 'bun',
      watch: true,
      autorestart: true,
      restart_delay: 5000,
    }
  ]
};
