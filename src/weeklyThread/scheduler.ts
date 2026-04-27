import { Scheduler } from "@devvit/public-api";
import { WEEKLY_THREAD_CRON, WEEKLY_THREAD_JOB_NAME } from "./constants.js";

export async function ensureWeeklyThreadJob(
  scheduler: Scheduler,
): Promise<void> {
  const jobs = await scheduler.listJobs();
  const duplicateJobs = jobs.filter(
    (job) => job.name === WEEKLY_THREAD_JOB_NAME,
  );

  await Promise.all(duplicateJobs.map((job) => scheduler.cancelJob(job.id)));

  await scheduler.runJob({
    name: WEEKLY_THREAD_JOB_NAME,
    cron: WEEKLY_THREAD_CRON,
  });
}
