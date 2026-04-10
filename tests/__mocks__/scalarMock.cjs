// Mock for @scalar/express-api-reference to support Jest testing
module.exports = {
    apiReference: () => (_request, _response, next) => next(),
};
