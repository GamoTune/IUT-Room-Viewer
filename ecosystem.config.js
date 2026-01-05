module.exports = {
  apps: [
    {
      name: 'IUT-Room-Viewer API',
      cwd: '/programs/iut-room-viewer/server',
      script: 'src/index.ts',
      interpreter: 'bun',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'IUT-Room-Viewer Bot',
      cwd: '/programs/iut-room-viewer/bot',
      script: 'src/index.ts',
      interpreter: 'bun',
      watch: false,
      autorestart: true,
      restart_delay: 5000,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
