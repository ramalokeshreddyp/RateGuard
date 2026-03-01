db = db.getSiblingDB('ratelimitdb');

db.clients.createIndex({ clientId: 1 }, { unique: true });
db.clients.createIndex({ apiKeyFingerprint: 1 }, { unique: true });

db.clients.insertMany([
  {
    clientId: 'seed-client-basic',
    hashedApiKey: '$2a$12$uWQkacQ7I2W6b0r4rlx2xOoV7mF2Ci9v6I5mGt4c9M8P6W8JboNGi',
    apiKeyFingerprint:
      '52f327f2ac3443f55f5d5007c4190ca5f42f6b97f3e53d7dd193f4ca0d6e2af2',
    maxRequests: 10,
    windowSeconds: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    clientId: 'seed-client-pro',
    hashedApiKey: '$2a$12$5wJ0H7VgORbpnQ5l8lQ0c.VOVvT5yD0d0l3V2QkHf6rXk0h3T8fA2',
    apiKeyFingerprint:
      'f6a8e056f2007f2080f27f61f68a3e21106be0b59cb5298297bc6f85f0b5bc5d',
    maxRequests: 100,
    windowSeconds: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    clientId: 'seed-client-burst',
    hashedApiKey: '$2a$12$Xkzqot3n0ud7nKrf1yI4QeG0eIm.2z2rM5y6zNmmrB6mH3O6z2IJe',
    apiKeyFingerprint:
      '3e8fd56f97ebf67f6f68d7294f4899f8e2cc8fcce7647750f9d16e2e5b8f4d66',
    maxRequests: 500,
    windowSeconds: 60,
    createdAt: new Date(),
    updatedAt: new Date()
  }
], { ordered: false });
