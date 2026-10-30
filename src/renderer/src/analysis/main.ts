import type {AnalysisJob, AnalysisReply} from '@core/schema/mediaAnalysis';
import {analyseMedia} from './analyseMedia';

declare global {
  interface Window {
    /** Main calls it with `executeJavaScript`, one file at a time. */
    analyseMedia?: (job: AnalysisJob) => Promise<AnalysisReply>;
  }
}

window.analyseMedia = job => analyseMedia(job);
