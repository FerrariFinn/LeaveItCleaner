-- Leave it cleaner — migration: only one summary per month.
-- Run this once in the Supabase SQL editor (after schema.sql).

-- Remove duplicates generated so far, keeping the oldest summary of each month.
delete from summaries a
using summaries b
where a.month = b.month
  and a.id > b.id;

alter table summaries
  add constraint summaries_month_unique unique (month);
