import { describe, it, expect } from 'vitest';
import { validate } from 'class-validator';
import { LoginDto } from '../src/modules/auth/dto/login.dto';

/**
 * LoginDto Contract Tests
 *
 * Verifies that the LoginDto correctly accepts:
 *   - Short numeric-looking usernames like "009"
 *   - Short passwords like "000"
 *
 * And correctly rejects:
 *   - Empty username
 *   - Empty password
 *   - Missing fields
 */
describe('LoginDto — field contract & validation', () => {
  it('POST /api/auth/login accepts username="009" and password="000" without validation errors', async () => {
    const dto = new LoginDto();
    dto.username = '009';
    dto.password = '000';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('POST /api/auth/login accepts username="admin@alkabeer.local" and any non-empty password', async () => {
    const dto = new LoginDto();
    dto.username = 'admin@alkabeer.local';
    dto.password = 'any_pass';

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('POST /api/auth/login rejects empty username with validation error', async () => {
    const dto = new LoginDto();
    dto.username = '';
    dto.password = '000';

    const errors = await validate(dto);
    const usernameProp = errors.find((e) => e.property === 'username');
    expect(usernameProp).toBeDefined();
  });

  it('POST /api/auth/login rejects empty password with validation error', async () => {
    const dto = new LoginDto();
    dto.username = '009';
    dto.password = '';

    const errors = await validate(dto);
    const passwordProp = errors.find((e) => e.property === 'password');
    expect(passwordProp).toBeDefined();
  });

  it('POST /api/auth/login rejects missing username and password with two validation errors', async () => {
    const dto = new LoginDto();
    // Both fields undefined

    const errors = await validate(dto);
    const props = errors.map((e) => e.property);
    expect(props).toContain('username');
    expect(props).toContain('password');
  });
});
