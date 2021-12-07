const Hapi = require('@hapi/hapi');
const dotenv = require('dotenv');
const hapiAuthJWT = require('hapi-auth-jwt2');
const routes = require('./routes');
const { validateJwt } = require('./utils/jwt-utils');

const init = async() => {
  dotenv.config();

  const server = Hapi.server({
    port: 5000,
    host: 'localhost',
  });

  // Configure auth
  await server.register(hapiAuthJWT);

  server.auth.strategy(
    'jwt',
    'jwt', {
      key: process.env.JWT_SECRET,
      validate: validateJwt,
      verifyOptions: { ignoreExpiration: true },
    },
  );

  server.auth.default('jwt');

  // Setup routes
  server.route(routes);

  // Start server
  await server.start();
  console.log(`Server is running on ${server.info.uri}`);
};

init();