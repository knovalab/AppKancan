import { describe, expect, it } from 'vitest';
import * as worker from '../src/worker.ts';

describe('Worker Queue Engine', () => {
	it('throws 404 error when enqueuing an unregistered hook', () => {
		expect(() => worker.enqueue('non_existing_hook', {})).toThrowError(
			/not registered/,
		);
	});

	it('enqueues a registered hook and executes asynchronously', async () => {
		const queued = worker.enqueue('dummy-task', { id: 'test-1' });
		expect(queued.status).toBe('queued');
		expect(queued.jobId).toBeDefined();

		// Check job is retrievable immediately
		const immediateJob = worker.getJob(queued.jobId);
		expect(immediateJob).not.toBeNull();
		expect(immediateJob?.name).toBe('dummy-task');

		// Wait for dummy-task (sleeps 300ms) to complete
		await new Promise((res) => setTimeout(res, 450));

		const finishedJob = worker.getJob(queued.jobId);
		expect(finishedJob?.status).toBe('completed');
		expect(finishedJob?.durationMs).toBeGreaterThan(200);
		expect(finishedJob?.result).toBeDefined();
		expect(finishedJob?.logs.length).toBeGreaterThan(0);
	});

	it('returns queue stats', () => {
		const stats = worker.getQueueStats();
		expect(stats.maxConcurrentJobs).toBeGreaterThan(0);
		expect(typeof stats.activeJobs).toBe('number');
		expect(typeof stats.queuedJobs).toBe('number');
	});
});
