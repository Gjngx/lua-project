import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

const line = readFileSync('.env', 'utf8')
	.split(/\r?\n/)
	.find((entry) => entry.startsWith('APP_PASSWORD='));

if (!line) throw new Error('Add APP_PASSWORD to .env before running this command');

const password = line.slice('APP_PASSWORD='.length).replace(/^(['"])(.*)\1$/, '$2');
if (password.length < 12) throw new Error('APP_PASSWORD must be at least 12 characters');

const salt = randomBytes(16);
const rounds = 600_000;
const hash = pbkdf2Sync(password, salt, rounds, 32, 'sha256');

console.log(
	`APP_PASSWORD_HASH=pbkdf2_sha256$${rounds}$${salt.toString('base64url')}$${hash.toString('base64url')}`,
);
console.log(`AUTH_SECRET=${randomBytes(32).toString('base64url')}`);
console.log('\nDelete APP_PASSWORD after saving both values above.');
