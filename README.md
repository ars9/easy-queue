# @ars9/easy-queue

A simple promise-based job queue with concurrency.

Example:

```js
// import { Queue } from '@ars9/easy-queue'); /* Correct Typescript import */
const { Queue } = require('@ars9/easy-queue');

// Create a queue instance with concurrency 3
const q = new Queue(3);

// Add some jobs to queue
q.enqueue(() => console.log(`I'm doing my part`));
q.enqueue(() => console.log(`Thanks me too`));
q.enqueue(() => console.log(`And my axe!`));

// By default, exceptions are handled, but silenced. You can attach a custom handler.
q.onError((error) => console.error(error));

// Start execution. This method will be implicitly called in `wait` if omitted.
q.start();

// Wait for execution. Starts queue if needed.
q.wait().then(() => console.log(`Done`));

// Console output:
/*
 I'm doing my part
 Thanks me too
 And my axe!
 Done
*/
```
