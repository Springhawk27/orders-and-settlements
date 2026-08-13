import request from 'supertest';
import app from '../../src/app';

export type TestUser = {
  cookies: string[];
  id: string;
  email: string;
};

/** Registers a user and returns the cookies needed to act as them. */
export const createTestUser = async (label = 'user'): Promise<TestUser> => {
  const email = `${label}@example.com`;

  const response = await request(app)
    .post('/api/v1/auth/register')
    .send({ name: `Test ${label}`, email, password: 'correct-horse-battery' });

  const raw = response.headers['set-cookie'];

  return {
    cookies: Array.isArray(raw) ? (raw as string[]) : [],
    id: response.body.data.id,
    email,
  };
};
