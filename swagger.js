const swaggerJSDoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Folklora API',
      version: '1.0.0',
      description: 'API dokumentacija za digitalno garderobo folklorne skupine KLOBUK',
    },
    servers: [
      {
        url: 'http://localhost:3000',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },

    //GLOBALNA zaščita za vse endpoint-e
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  
  apis: ['./routes/*.js'], // where your routes are
};

module.exports = swaggerJSDoc(options);
