import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const envPath = '.env';
const envSource = readFileSync(envPath, 'utf8');
const escapeEnvValue = (value) => value.replaceAll('$', '\\$');

if (process.argv.includes('--fix-env')) {
	const nextEnv = envSource
		.split(/\r?\n/)
		.map((entry) => {
			if (!entry.startsWith('APP_PASSWORD_HASH=')) return entry;
			const value = entry.slice('APP_PASSWORD_HASH='.length).replaceAll('\\$', '$');
			return `APP_PASSWORD_HASH=${escapeEnvValue(value)}`;
		})
		.join('\n');

	writeFileSync(envPath, nextEnv.endsWith('\n') ? nextEnv : `${nextEnv}\n`, { mode: 0o600 });
	console.log('Escaped APP_PASSWORD_HASH for Vite environment loading.');
	process.exit(0);
}

const line = envSource
	.split(/\r?\n/)
	.find((entry) => entry.startsWith('APP_PASSWORD='));

if (!line) throw new Error('Add APP_PASSWORD to .env before running this command');

const password = line.slice('APP_PASSWORD='.length).replace(/^(['"])(.*)\1$/, '$2');
if (password.length < 12) throw new Error('APP_PASSWORD must be at least 12 characters');

const salt = randomBytes(16);
const rounds = 600_000;
const hash = pbkdf2Sync(password, salt, rounds, 32, 'sha256');
const passwordHash = `pbkdf2_sha256$${rounds}$${salt.toString('base64url')}$${hash.toString('base64url')}`;
const secret = randomBytes(32).toString('base64url');

if (process.argv.includes('--write')) {
	const nextEnv = envSource
		.split(/\r?\n/)
		.filter((entry) => !entry.startsWith('APP_PASSWORD='))
		.map((entry) => {
			if (entry.startsWith('APP_PASSWORD_HASH=')) {
				return `APP_PASSWORD_HASH=${escapeEnvValue(passwordHash)}`;
			}
			if (entry.startsWith('AUTH_SECRET=')) return `AUTH_SECRET=${secret}`;
			return entry;
		})
		.join('\n');

	writeFileSync(envPath, nextEnv.endsWith('\n') ? nextEnv : `${nextEnv}\n`, { mode: 0o600 });
	console.log('Updated .env with a new password hash and auth secret; removed APP_PASSWORD.');
} else {
	console.log(`APP_PASSWORD_HASH=${escapeEnvValue(passwordHash)}`);
	console.log(`AUTH_SECRET=${secret}`);
	console.log('\nRun with --write to update .env and remove APP_PASSWORD automatically.');
}
