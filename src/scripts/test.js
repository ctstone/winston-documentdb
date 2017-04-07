/// <reference types="../../typings/documentdb/index.d.ts" />

const winston = require('winston');
const ddb = require('documentdb');
const DocumentDbLogger = require('../winston-documentdb').DocumentDbLogger;

const client = new ddb.DocumentClient('https://chstone-logs.documents.azure.com:443/', {masterKey: '72LEPZpOBlpoxKXJbJjY7cbiWjw4NbBcXn8hchRDcTg3tVri0M9WozLiIwJ7JYhvPX7Aadxpeed8EP7pyYvOmA=='});
winston.add(DocumentDbLogger, {
  client,
  databaseName: 'admin',
  collectionName: 'temp1',
});

winston.info('foo', {x: new Buffer(1)}, (err) => {
  console.log(err);
});