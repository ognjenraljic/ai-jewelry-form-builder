// Deployment prerequisite: create the independent encryption key once, never rotate it on deploy.
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli = fileURLToPath(new URL('../node_modules/wrangler/bin/wrangler.js', import.meta.url));
const secrets = JSON.parse(execFileSync(process.execPath, [cli, 'secret', 'list', '--format', 'json'], { encoding: 'utf8' }));
if (secrets.some((s) => s.name === 'PORTAL_LINK_KEY')) {
  console.log('Portal link encryption key already configured.');
} else {
  const secret = randomBytes(32).toString('hex');
  if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${secret}`);
  execFileSync(process.execPath, [cli, 'secret', 'put', 'PORTAL_LINK_KEY'], { input: secret, stdio: ['pipe', 'inherit', 'inherit'] });
  console.log('Portal link encryption key configured.');
}
