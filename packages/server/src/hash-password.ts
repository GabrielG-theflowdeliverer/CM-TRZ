import { hashPassword } from './infra/auth.js';

/**
 * Generate the CMT_EDITOR_PASSWORD_HASH secret from a plaintext password,
 * locally — the plaintext never leaves your machine or gets committed.
 *
 *   npm run hash-password -- 'your password here'
 *
 * then: fly secrets set CMT_EDITOR_PASSWORD_HASH='<output>'
 */
const password = process.argv[2] ?? process.env.CMT_PASSWORD;
if (!password) {
  console.error("Usage: npm run hash-password -- '<password>'");
  process.exit(1);
}
console.log(hashPassword(password));
