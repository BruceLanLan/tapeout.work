import { readFile } from 'node:fs/promises';
import path from 'node:path';

const work = process.argv[2];
if (!work) throw new Error('Usage: node scripts/assert_activity_timeseries_contract.mjs <response-dir>');
const load = async name => JSON.parse(await readFile(path.join(work, name), 'utf8'));
const fail = message => { throw new Error(`Activity time-series contract failed: ${message}`); };
const [daily, hourly, utc, all] = await Promise.all([
  load('daily.json'), load('activity-hour.json'), load('activity-utc.json'), load('activity-all.json'),
]);

const assertSeries = (data, label) => {
  if (data.mode !== 'time_series') fail(`${label} must declare time_series mode`);
  if (!['hour', 'day'].includes(data.granularity) || !['Asia/Shanghai', 'UTC'].includes(data.timezone)) fail(`${label} lacks valid granularity/timezone`);
  if (!Array.isArray(data.buckets)) fail(`${label} must return buckets`);
  if (data.buckets.some(row => !row.bucket_start || !Object.hasOwn(row, 'new_processors') || !Object.hasOwn(row, 'circuit_delta') || !Object.hasOwn(row, 'processor_total') || !Object.hasOwn(row, 'circuit_total'))) fail(`${label} lacks required observed and cumulative fields`);
  if (data.buckets.some(row => data.coverage_start && Date.parse(row.bucket_start_utc) + 86_400_000 < Date.parse(data.coverage_start))) fail(`${label} fabricated a bucket wholly before D1 coverage`);
};
assertSeries(daily, 'daily'); assertSeries(hourly, 'hourly'); assertSeries(utc, 'utc'); assertSeries(all, 'all');
if (daily.requested_range !== '7d' || daily.granularity !== 'day' || daily.timezone !== 'Asia/Shanghai') fail('default dashboard series must be 7d/day/Asia-Shanghai');
if (hourly.requested_range !== '1d' || hourly.granularity !== 'hour') fail('hourly selector must preserve 1d/hour request');
if (utc.timezone !== 'UTC' || utc.granularity !== 'day') fail('UTC selector must preserve daily UTC request');
if (all.requested_range !== 'all') fail('all-observed selector must preserve request');
if (!daily.buckets.length || !hourly.buckets.length || !all.buckets.length) fail('populated local snapshot must have observed buckets for each supported selection');
console.log('PASS: multi-period activity time-series contract assertions completed');
