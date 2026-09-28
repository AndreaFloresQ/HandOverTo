const request = require('supertest');
const app = require('../src/app');

describe('Salud del servidor', () => {
  it('responde ok en /api/health', async () => {
    const respuesta = await request(app).get('/api/health');
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({ ok: true });
  });
});