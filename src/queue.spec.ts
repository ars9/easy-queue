import { Queue } from './queue';

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Queue', () => {
  let jobsDone = 0;
  let jobsStarted = 0;

  const JOB_LENGTH = 15;

  // Unhandled rejections should be considered failure
  process.on('unhandledRejection', err => fail(err));

  afterEach(() => {
    jobsStarted = 0;
    jobsDone = 0;
  });

  const jobFactory = (duration: number) => () => {
    return new Promise(resolve => {
      jobsStarted++;
      setTimeout(() => {
        jobsDone++;
        resolve();
      }, duration);
    });
  };

  it('should return immediately if there are no tasks', async () => {
    const q = new Queue();

    const t0 = Date.now() / 1000;
    await q.wait();
    expect(t0).toBeCloseTo(Date.now() / 1000);
  });

  it('should execute all jobs with default settings', async () => {
    const q = new Queue();

    for (const _ of Array(10)) {
      q.enqueue(jobFactory(JOB_LENGTH));
    }

    // Expect 10 jobs in pending
    expect(q.pendingJobs).toBe(10);

    // Start jobs
    q.start();

    // Sleep for a short period
    await sleep(JOB_LENGTH * 0.1);

    // Expect that all jobs have been started
    expect(q.jobs).toBe(10);
    expect(q.pendingJobs).toBe(0);
    expect(jobsStarted).toBe(10);
    expect(jobsDone).toBe(0);

    // Wait for finish
    await q.wait();

    // Make sure that work has been done
    expect(q.jobs).toBe(0);
    expect(q.pendingJobs).toBe(0);
    expect(jobsStarted).toBe(10);
    expect(jobsDone).toBe(10);
  });

  it('should fail on invalid concurrency parameter', async () => {
    const rangeError = `"concurrency" should be positive finite number`;
    expect(() => new Queue(-1)).toThrowError(rangeError);
    expect(() => new Queue(Infinity)).toThrowError(rangeError);
    expect(() => new Queue(NaN)).toThrowError(rangeError);
    expect(() => new Queue(0)).toThrowError(rangeError);

    const typeError = `"concurrency" should be a number`;
    expect(() => new Queue('1' as any)).toThrowError(typeError);
    expect(() => new Queue([] as any)).toThrowError(typeError);
    expect(() => new Queue({} as any)).toThrowError(typeError);
  });

  it('should execute jobs with correct concurrency', async () => {
    const q = new Queue();

    for (const _ of Array(20)) {
      q.enqueue(jobFactory(JOB_LENGTH));
    }

    // Expect 20 jobs in pending
    expect(q.pendingJobs).toBe(20);

    q.start();

    // Sleep for a short period
    await sleep(JOB_LENGTH * 0.1);

    // Expect that some of all jobs have been started
    expect(q.jobs).toBe(10);
    expect(q.pendingJobs).toBe(10);
    expect(jobsStarted).toBe(10);
    expect(jobsDone).toBe(0);

    // Sleep until first batch is finished
    await sleep(JOB_LENGTH * 1.1);

    // Expect that first batch has been executed and second batch is in progress
    expect(q.jobs).toBe(10);
    expect(q.pendingJobs).toBe(0);
    expect(jobsStarted).toBe(20);
    expect(jobsDone).toBe(10);

    // Wait for all jobs to be finished
    await q.wait();

    expect(q.jobs).toBe(0);
    expect(q.pendingJobs).toBe(0);
    expect(jobsStarted).toBe(20);
    expect(jobsDone).toBe(20);
  });

  it('should silenced exceptions by default', async () => {
    const q = new Queue();

    const failure = () => new Promise((_, reject) => reject(`FAIL`));

    q.enqueue(failure);

    // This will fail on unhandled rejection
    await q.wait();
  });

  it('should catch exceptions with custom handler', async () => {
    const q = new Queue();

    const failure = () => new Promise((_, reject) => reject(`FAIL`));

    process.on('unhandledRejection', err => fail(err));

    const onError = jest.fn();
    q.onError(onError);

    q.enqueue(failure);

    await q.wait();

    expect(onError).toBeCalledWith(`FAIL`);
  });

  it('should handle non-async jobs correctly', async () => {
    const q = new Queue(2);

    const j = () => {
      jobsStarted++;
      jobsDone++;
    };

    q.enqueue(j);
    q.enqueue(j);
    q.enqueue(j);

    await q.wait();

    expect(jobsStarted).toBe(3);
    expect(jobsDone).toBe(3);
  });
});
