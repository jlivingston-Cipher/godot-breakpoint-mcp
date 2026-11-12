// 🆕 BP-0062 (1.95.0): the thread `offThread` starts (measure.ts). It runs the one job it was
// handed, posts the answer and ends; it holds no listener, so nothing keeps it alive afterwards.

import { parentPort, workerData } from "node:worker_threads";
import { runJob, type MeasureJob } from "./measure.js";

parentPort?.postMessage(runJob(workerData as MeasureJob));
