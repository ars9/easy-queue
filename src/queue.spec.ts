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
    return new Promise<void>(resolve => {
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

    Array(10).fill(null).forEach(() => q.enqueue(jobFactory(JOB_LENGTH)));

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
    expect(() => new Queue(-1)).toThrow(rangeError);
    expect(() => new Queue(Infinity)).toThrow(rangeError);
    expect(() => new Queue(NaN)).toThrow(rangeError);
    expect(() => new Queue(0)).toThrow(rangeError);

    const typeError = `"concurrency" should be a number`;

    // @ts-expect-error Queue expects a number
    expect(() => new Queue('1')).toThrow(typeError);
    // @ts-expect-error Queue expects a number
    expect(() => new Queue([])).toThrow(typeError);
    // @ts-expect-error Queue expects a number
    expect(() => new Queue({})).toThrow(typeError);
  });

  it('should execute jobs with correct concurrency', async () => {
    const q = new Queue();

    Array(20).fill(null).forEach(() => q.enqueue(jobFactory(JOB_LENGTH)));

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

    expect(onError).toHaveBeenCalledWith(`FAIL`);
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
