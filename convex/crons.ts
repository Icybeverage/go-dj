import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "Refresh Outside Lands lineup from JamBase",
  { hours: 12 },
  internal.jambase.refreshOutsideLands,
  {},
);

export default crons;
