# Installation

```
npm install --save winston-documentdb
```

## Peer dependencies
```
npm install --save winston documentdb
```

# Usage

## TypeScript
```TypeScript
import { DocumentClient } from 'documentdb';
import { DocumentDbTransport } from 'winston-documentdb';
import winston = require('winston');

// winston typedefs are hostile to extensions, so downtype DocumentDbTransport to any
winston.add(DocumentDbTransport as any, {
  client: new DocumentClient(/* params */),
  databaseName: 'yourDatabase',
  collectionName: 'yourCollection',
});

winston.info('hello world', {foo:['bar', 123]});
```

## JavaScript
```JavaScript
const ddb = require('documentdb');
const winston = require('winston');
require('winston-documentdb');

winston.add(winston.DocumentDb, {
  client: new ddb.DocumentClient(/* params */),
  databaseName: 'yourDatabase',
  collectionName: 'yourCollection',
});

winston.info('hello world', {foo:['bar', 123]});
```

## Buffer objects inside meta
By default, any `Buffer` object found on a log event's `meta` object will not be serialized on the document. Instead, the buffer is stored as a reference, viewable as `{"$media": "id"}`. The buffer contents are stored as a media attachment for the document. Modify `DocumentDbTransportOptions.attachMedia` to change this behavior.

## Concurrency
By default, logs are stored one-at-a-time in order to reserve network IO for core application resources.  Modify `DocumentDbTransportOptions.concurrency` to change this behavior.

# API

## DocumentDbTransport
```TypeScript
/** constructor **/
const ddb = new DocumentDbTransport(documentDbTransportOptions);

/** methods **/
// Log an event
ddb.log(level, message, meta, callback);

/** events **/
// Fired for any Buffer object found in a log's meta object
ddb.on('media', (media) => {
  const id = media.id; // string (md5 of Buffer)
  const data = media.data; // Buffer
  media.id = myHash(data); // optionally reassign the id
});
```

## DocumentDbTransportOptions
```JavaScript
{
  /** DocumentDb database name (created if it does not exist) */
  databaseName: string;

  /** DocumentDb collection name (created if it does not exist) */
  collectionName: string;

  /** Max simultaneous writes to DocumentDb (default: 1) */
  concurrency?: number;

  /** Replace any Buffer object in event meta object with a hash of the buffer (default: true) */
  attachMedia?: boolean;

  /** Collection throughput for created collections (default: 10000) */
  collectionThroughput?: number;

  /** Default time-to-live for created collections */
  defaultTtl?: number;

  /** Partition key to use, if the collection is partitioned */
  partitionKey?: string;
}
```
