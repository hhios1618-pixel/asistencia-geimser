import { runQuery } from './postgres';

let peopleServiceColumnEnsured = false;

export const ensurePeopleServiceColumn = async () => {
  if (peopleServiceColumnEnsured) {
    return;
  }
  await runQuery('alter table public.people add column if not exists service text');
  peopleServiceColumnEnsured = true;
};
