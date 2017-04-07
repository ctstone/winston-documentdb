const winston = require('winston');
const ddb = require('documentdb');
const DocumentDbLogger = require('../winston-documentdb').DocumentDbLogger;

const key = '';
const client = new ddb.DocumentClient('https://chstone-logs.documents.azure.com:443/', {masterKey: key});
winston.add(DocumentDbLogger, {
  client,
  databaseName: 'admin',
  collectionName: 'temp1',
});

winston.info('foo', {x: new Buffer(1)}, (err) => {
  console.log(err);
});