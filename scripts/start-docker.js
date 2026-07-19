import net from 'net';
import { spawn } from 'child_process';

const DEFAULT_GITLAB_HOST_PORT = 8929;
const DEFAULT_GITLAB_SSH_HOST_PORT = 2222;
const MAX_PORT_SCAN = 20;

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once('error', () => {
      resolve(false);
    });

    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port);
  });
}

async function resolvePort(envName, defaultPort) {
  const explicitPort = process.env[envName];
  if (explicitPort) {
    return explicitPort;
  }

  for (let offset = 0; offset < MAX_PORT_SCAN; offset += 1) {
    const candidate = defaultPort + offset;
    // eslint-disable-next-line no-await-in-loop
    if (await isPortAvailable(candidate)) {
      return String(candidate);
    }
  }

  throw new Error(`${envName} に利用可能なポートが見つかりませんでした。`);
}

async function main() {
  const gitlabHostPort = await resolvePort('GITLAB_HOST_PORT', DEFAULT_GITLAB_HOST_PORT);
  const gitlabSshHostPort = await resolvePort('GITLAB_SSH_HOST_PORT', DEFAULT_GITLAB_SSH_HOST_PORT);
  const gitlabPublicUrl = `http://gitlab.localhost:${gitlabHostPort}`;

  console.log(`[start-docker] GitLab HTTP公開ポート: ${gitlabHostPort}`);
  console.log(`[start-docker] GitLab SSH公開ポート: ${gitlabSshHostPort}`);

  const child = spawn(
    'docker-compose',
    ['up', '-d', '--force-recreate', '--build', 'app'],
    {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        GITLAB_HOST_PORT: gitlabHostPort,
        GITLAB_SSH_HOST_PORT: gitlabSshHostPort,
        GITLAB_PUBLIC_URL: gitlabPublicUrl
      }
    }
  );

  child.on('exit', (code) => {
    process.exit(code ?? 1);
  });

  child.on('error', (error) => {
    console.error('[start-docker] docker-compose 実行エラー:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('[start-docker] 起動準備エラー:', error);
  process.exit(1);
});