// import Fastify from "fastify";
// import dotenv from "dotenv";
// import fastifyFormBody from "@fastify/formbody";
// import fastifyWs from "@fastify/websocket";
// import { registerInboundRoutes } from './inbound-calls.js';
// import { registerOutboundRoutes } from './outbound-calls.js';

// // Load environment variables from .env file
// dotenv.config();

// // Initialize Fastify server
// const fastify = Fastify({
//   logger: true // Enable logging
// });

// fastify.register(fastifyFormBody);
// fastify.register(fastifyWs);

// const PORT = process.env.PORT || 8000;

// // Root route for health check
// fastify.get("/", async (_, reply) => {
//   reply.send({ message: "Server is running" });
// });

// // Start the Fastify server
// const start = async () => {
//   try {
//     // Register route handlers
//     await registerInboundRoutes(fastify);
//     await registerOutboundRoutes(fastify);

//     // Start listening
//     await fastify.listen({ port: PORT, host: '0.0.0.0' });
//     console.log(`[Server] Listening on port ${PORT}`);
//   } catch (err) {
//     fastify.log.error(err);
//     process.exit(1);
//   }
// };

// // Handle unhandled promise rejections
// process.on('unhandledRejection', (err) => {
//   console.error('Unhandled rejection:', err);
//   process.exit(1);
// });

// start();


import Fastify from "fastify";
import dotenv from "dotenv";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import { registerInboundRoutes } from './inbound-calls.js';
import { registerOutboundRoutes } from './outbound-calls.js';

// Load environment variables from .env file
dotenv.config();

// Initialize Fastify with serverless mode for Vercel
const fastify = Fastify({
  logger: true,
  serverless: true // Important for Vercel
});

// Register plugins
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Root route for health check
fastify.get("/", async (_, reply) => {
  reply.send({ message: "Server is running" });
});

// Register route handlers
registerInboundRoutes(fastify);
registerOutboundRoutes(fastify);

// For local development
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 8000;

  const start = async () => {
    try {
      await fastify.listen({ port: PORT, host: '0.0.0.0' });
      console.log(`[Server] Listening on port ${PORT}`);
    } catch (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  };

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('Unhandled rejection:', err);
    process.exit(1);
  });

  start();
}

// Export the serverless handler for Vercel
export default async function (req, res) {
  await fastify.ready();
  fastify.server.emit('request', req, res);
}