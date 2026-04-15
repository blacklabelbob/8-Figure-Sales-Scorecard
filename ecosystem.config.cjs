const fs = require('fs');
const path = require('path');

// Load .env.production.local at PM2 startup time
function loadEnv(filePath) {
  try {
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const env = {};
    lines.forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) env[m[1].trim()] = m[2].trim();
    });
    return env;
  } catch { return {}; }
}

const prodEnv = loadEnv(path.join(__dirname, '.env.production.local'));

module.exports = {
  apps: [
    {
      name: 'stg-scorecard',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      cwd: '/home/user/webapp',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
        ...prodEnv
      },
      watch: false,
      instances: 1,
      exec_mode: 'fork'
    }
  ]
}
