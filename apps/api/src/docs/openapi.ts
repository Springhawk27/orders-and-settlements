import {
  API_VERSION,
  createOrderSchema,
  loginSchema,
  recordPaymentSchema,
  registerSchema,
  updateOrderSchema,
  voidPaymentSchema,
} from '@crossval/shared';
import { z } from 'zod';

/**
 * Request schemas are converted from the same Zod objects the API validates
 * with, so the documentation cannot describe a contract the server does not
 * actually enforce. `io: 'input'` describes what a client sends rather than
 * what the schema produces after its transforms.
 */
const requestSchema = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-7' });

const errorResponse = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    message: { type: 'string' },
    errorMessages: {
      type: 'array',
      items: {
        type: 'object',
        properties: { path: { type: 'string' }, message: { type: 'string' } },
      },
    },
  },
} as const;

const responses = {
  Unauthorized: { description: 'No session, or the access token has expired' },
  NotFound: { description: 'Not found, or owned by another account' },
  ValidationFailed: { description: 'Validation failed' },
};

const jsonBody = (schema: unknown) => ({
  required: true,
  content: { 'application/json': { schema } },
});

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Orders and Settlements API',
    version: '1.0.0',
    description: [
      'Orders with line items, partial payments, and a derived payment status.',
      '',
      'Money is always expressed in **integer minor units** (fils, cents). Requests accept a',
      'decimal string such as `"1250.50"`; responses return `125050`.',
      '',
      '`POST /orders/{orderId}/payments` accepts an `Idempotency-Key` header. Repeating a',
      'request with the same key returns the original payment with `200` and an',
      '`Idempotent-Replay: true` header rather than recording a second one.',
    ].join('\n'),
  },
  servers: [{ url: `/api/${API_VERSION}` }],
  tags: [{ name: 'Auth' }, { name: 'Orders' }, { name: 'Payments' }, { name: 'Dashboard' }],
  components: {
    securitySchemes: {
      cookieAuth: { type: 'apiKey', in: 'cookie', name: 'access_token' },
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      RegisterRequest: requestSchema(registerSchema),
      LoginRequest: requestSchema(loginSchema),
      CreateOrderRequest: requestSchema(createOrderSchema),
      UpdateOrderRequest: requestSchema(updateOrderSchema),
      RecordPaymentRequest: requestSchema(recordPaymentSchema),
      VoidPaymentRequest: requestSchema(voidPaymentSchema),
      ErrorResponse: errorResponse,
    },
  },
  security: [{ cookieAuth: [] }, { bearerAuth: [] }],
  paths: {
    '/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Create an account and start a session',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/RegisterRequest' }),
        responses: {
          201: { description: 'Account created; auth cookies set' },
          409: { description: 'Email already registered' },
          400: responses.ValidationFailed,
        },
      },
    },
    '/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Start a session',
        security: [],
        requestBody: jsonBody({ $ref: '#/components/schemas/LoginRequest' }),
        responses: {
          200: { description: 'Signed in; auth cookies set' },
          401: { description: 'Email or password is incorrect' },
        },
      },
    },
    '/auth/refresh': {
      post: {
        tags: ['Auth'],
        summary: 'Rotate the session',
        description:
          'Replaces both tokens. Replaying a token that has already been rotated revokes every session for that user.',
        security: [],
        responses: { 200: { description: 'New tokens issued' }, 401: responses.Unauthorized },
      },
    },
    '/auth/logout': {
      post: {
        tags: ['Auth'],
        summary: 'End the session',
        responses: { 200: { description: 'Signed out' } },
      },
    },
    '/auth/me': {
      get: {
        tags: ['Auth'],
        summary: 'The signed-in user',
        responses: { 200: { description: 'The current user' }, 401: responses.Unauthorized },
      },
    },
    '/orders': {
      get: {
        tags: ['Orders'],
        summary: 'List orders',
        parameters: [
          {
            name: 'status',
            in: 'query',
            schema: { enum: ['pending', 'partially_paid', 'paid', 'overdue'] },
            description: '`overdue` is derived at read time and is never stored.',
          },
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string' },
            description: 'Customer name or order number',
          },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
          {
            name: 'sortBy',
            in: 'query',
            schema: {
              enum: ['createdAt', 'dueDate', 'totalMinor', 'orderNumber'],
              default: 'createdAt',
            },
          },
          { name: 'sortDir', in: 'query', schema: { enum: ['asc', 'desc'], default: 'desc' } },
        ],
        responses: { 200: { description: 'A page of orders' }, 401: responses.Unauthorized },
      },
      post: {
        tags: ['Orders'],
        summary: 'Create an order',
        description: 'Line and order totals are computed server side; anything sent is ignored.',
        requestBody: jsonBody({ $ref: '#/components/schemas/CreateOrderRequest' }),
        responses: { 201: { description: 'Order created' }, 400: responses.ValidationFailed },
      },
    },
    '/orders/export': {
      get: {
        tags: ['Orders'],
        summary: 'Export orders as CSV',
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: { description: 'CSV attachment', content: { 'text/csv': {} } },
          401: responses.Unauthorized,
        },
      },
    },
    '/orders/{id}': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Orders'],
        summary: 'One order with its line items',
        responses: { 200: { description: 'The order' }, 404: responses.NotFound },
      },
      patch: {
        tags: ['Orders'],
        summary: 'Update an order',
        description:
          'Line items may only be changed while the order has no payments against it. Due date and customer stay editable.',
        requestBody: jsonBody({ $ref: '#/components/schemas/UpdateOrderRequest' }),
        responses: {
          200: { description: 'Order updated' },
          409: { description: 'Line items are frozen because a payment exists' },
          404: responses.NotFound,
        },
      },
      delete: {
        tags: ['Orders'],
        summary: 'Delete an order',
        responses: {
          200: { description: 'Order deleted' },
          409: { description: 'The order has payments and cannot be deleted' },
        },
      },
    },
    '/orders/{id}/audit': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Orders'],
        summary: 'Append-only audit trail for an order',
        responses: { 200: { description: 'Events, newest first' }, 404: responses.NotFound },
      },
    },
    '/orders/{orderId}/payments': {
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Payments'],
        summary: 'Payment history, including reversals',
        responses: { 200: { description: 'Payments, newest first' }, 404: responses.NotFound },
      },
      post: {
        tags: ['Payments'],
        summary: 'Record a payment',
        description:
          'Applied through a single atomic conditional update, so simultaneous requests cannot take the balance past the order total.',
        parameters: [
          {
            name: 'Idempotency-Key',
            in: 'header',
            schema: { type: 'string' },
            description: 'Repeating a request with the same key returns the original payment.',
          },
        ],
        requestBody: jsonBody({ $ref: '#/components/schemas/RecordPaymentRequest' }),
        responses: {
          201: { description: 'Payment recorded, with the updated order' },
          200: { description: 'Already recorded under this key; `Idempotent-Replay: true`' },
          409: {
            description: 'Would exceed the order total; the error names the maximum still allowed',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
            },
          },
          404: responses.NotFound,
        },
      },
    },
    '/orders/{orderId}/payments/reconcile': {
      parameters: [{ name: 'orderId', in: 'path', required: true, schema: { type: 'string' } }],
      get: {
        tags: ['Payments'],
        summary: 'Check the stored balance against the payment records',
        description:
          'Recomputes the sum of payments and compares it with the denormalised balance held on the order.',
        responses: { 200: { description: 'Stored, recomputed, and whether they agree' } },
      },
    },
    '/payments/{id}/void': {
      parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
      post: {
        tags: ['Payments'],
        summary: 'Void a payment',
        description:
          'Writes a compensating reversal entry and marks the original as voided. Nothing is deleted.',
        requestBody: jsonBody({ $ref: '#/components/schemas/VoidPaymentRequest' }),
        responses: {
          200: { description: 'Reversal written, with the updated order' },
          409: { description: 'Already voided, or the target is itself a reversal' },
          404: responses.NotFound,
        },
      },
    },
    '/dashboard/summary': {
      get: {
        tags: ['Dashboard'],
        summary: 'Outstanding, overdue, collections and ageing',
        responses: { 200: { description: 'Summary figures' }, 401: responses.Unauthorized },
      },
    },
  },
} as const;
