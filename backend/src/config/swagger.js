import swaggerJsdoc from 'swagger-jsdoc';

const definition = {
  openapi: '3.0.3',
  info: {
    title: 'Multi-Vendor Marketplace API',
    version: '1.0.0',
    description:
      'REST API for the marketplace. Access tokens go in the `Authorization: Bearer` header; ' +
      'the refresh token is an httpOnly cookie scoped to /api/v1/auth.',
  },
  servers: [{ url: '/api/v1' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '665f1c2e8b3a4c0012ab34cd' },
          name: { type: 'string', example: 'Ram Kumar' },
          email: { type: 'string', example: 'ram@example.com' },
          phone: { type: 'string', example: '+919876543210' },
          role: { type: 'string', enum: ['customer', 'seller', 'admin'] },
          status: { type: 'string', enum: ['active', 'blocked'] },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      RegisterInput: {
        type: 'object',
        required: ['name', 'email', 'password'],
        properties: {
          name: { type: 'string', example: 'Ram Kumar' },
          email: { type: 'string', example: 'ram@example.com' },
          password: { type: 'string', example: 'Secret@123' },
          phone: { type: 'string', example: '+919876543210' },
        },
      },
      LoginInput: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', example: 'ram@example.com' },
          password: { type: 'string', example: 'Secret@123' },
          portal: { type: 'string', enum: ['customer', 'seller', 'admin'] },
        },
      },
      AuthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          message: { type: 'string', example: 'Logged in successfully' },
          data: {
            type: 'object',
            properties: {
              user: { $ref: '#/components/schemas/User' },
              accessToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiIs...' },
            },
          },
        },
      },
      Error: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Validation failed' },
          errors: {
            type: 'array',
            items: {
              type: 'object',
              properties: { field: { type: 'string' }, message: { type: 'string' } },
            },
          },
        },
      },
    },
    responses: {
      ValidationError: {
        description: 'Validation failed',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
  },
};

export const swaggerSpec = swaggerJsdoc({
  definition,
  apis: ['./src/routes/*.js'],
});
