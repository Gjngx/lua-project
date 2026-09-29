const encoder = new TextEncoder();
const PASSWORD_ALGORITHM = 'pbkdf2_sha256';
const SESSION_VERSION = 'v1';

export const AUTH_COOKIE = 'site_auth';
export const SESSION_DURATION_SECONDS = 60 * 60 * 24 * 7;

function decode(value = '') {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
	return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function encode(value: ArrayBuffer) {
	const binary = String.fromCharCode(...new Uint8Array(value));
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function hmacKey(secret: string) {
	const bytes = decode(secret);
	if (bytes.length < 32) throw new Error('AUTH_SECRET must contain at least 32 random bytes');
	return crypto.subtle.importKey('raw', bytes, { name: 'HMAC', hash: 'SHA-256' }, false, [
		'sign',
		'verify',
	]);
}

export function hasValidAuthConfig(passwordHash?: string, secret?: string) {
	try {
		const [algorithm, rounds, salt, hash] = passwordHash?.split('$') ?? [];
		return (
			algorithm === PASSWORD_ALGORITHM &&
			Number(rounds) >= 600_000 &&
			decode(salt).length >= 16 &&
			decode(hash).length === 32 &&
			decode(secret ?? '').length >= 32
		);
	} catch {
		return false;
	}
}

export async function verifyPassword(password: string, storedHash: string) {
	if (password.length > 128) return false;

	const [algorithm, roundsValue, saltValue, expectedValue] = storedHash.split('$');
	const rounds = Number(roundsValue);
	if (algorithm !== PASSWORD_ALGORITHM || !Number.isSafeInteger(rounds) || rounds < 600_000) {
		return false;
	}

	try {
		const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
			'deriveBits',
		]);
		const actual = new Uint8Array(
			await crypto.subtle.deriveBits(
				{ name: 'PBKDF2', hash: 'SHA-256', salt: decode(saltValue), iterations: rounds },
				key,
				256,
			),
		);
		const expected = decode(expectedValue);
		let difference = actual.length ^ expected.length;
		for (let index = 0; index < actual.length; index++) {
			difference |= actual[index] ^ (expected[index] ?? 0);
		}
		return difference === 0;
	} catch {
		return false;
	}
}

export async function createSession(secret: string) {
	const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS;
	const payload = `${SESSION_VERSION}.${expiresAt}`;
	const signature = await crypto.subtle.sign(
		'HMAC',
		await hmacKey(secret),
		encoder.encode(payload),
	);
	return `${payload}.${encode(signature)}`;
}

export async function verifySession(token: string, secret: string) {
	try {
		const [version, expiresValue, signatureValue, extra] = token.split('.');
		const expiresAt = Number(expiresValue);
		if (
			version !== SESSION_VERSION ||
			extra !== undefined ||
			!Number.isSafeInteger(expiresAt) ||
			expiresAt <= Math.floor(Date.now() / 1000)
		) {
			return false;
		}

		return crypto.subtle.verify(
			'HMAC',
			await hmacKey(secret),
			decode(signatureValue),
			encoder.encode(`${version}.${expiresValue}`),
		);
	} catch {
		return false;
	}
}
