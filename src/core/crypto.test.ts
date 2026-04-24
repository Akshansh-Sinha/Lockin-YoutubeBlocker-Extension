import { describe, it, expect } from 'vitest';
import { generateSalt, hashPassword, verifyPassword } from './crypto';

describe('Crypto Module', () => {
  it('generates random salts of correct format', () => {
    const salt1 = generateSalt();
    const salt2 = generateSalt();
    
    expect(salt1).toBeTypeOf('string');
    expect(salt1.length).toBeGreaterThan(0);
    expect(salt1).not.toEqual(salt2);
  });

  it('hashes password and verifies correctly', async () => {
    const salt = generateSalt();
    const password = 'mySecretPassword123!';
    
    const hash = await hashPassword(password, salt);
    
    expect(hash).toBeTypeOf('string');
    expect(hash).not.toEqual(password);
    
    const isValid = await verifyPassword(password, hash, salt);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect passwords', async () => {
    const salt = generateSalt();
    const password = 'mySecretPassword123!';
    
    const hash = await hashPassword(password, salt);
    
    const isValid = await verifyPassword('wrongpassword', hash, salt);
    expect(isValid).toBe(false);
  });
});
