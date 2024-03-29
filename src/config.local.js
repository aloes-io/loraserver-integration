module.exports = {
  restApiRoot: `${process.env.REST_API_ROOT}`,
  host: process.env.HTTP_SERVER_HOST,
  port: Number(process.env.HTTP_SERVER_PORT),
  remoting: {
    rest: {
      handleErrors: false,
      normalizeHttpPath: false,
      xml: false,
    },
    json: {
      strict: true,
      limit: '20mb',
    },
    urlencoded: {
      extended: true,
      limit: '20mb',
    },
    cors: false,
    handleErrors: false,
  },
};
