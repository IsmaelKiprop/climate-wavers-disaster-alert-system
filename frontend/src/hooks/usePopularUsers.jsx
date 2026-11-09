import { useQuery } from '@tanstack/react-query';
import { client } from '../api';
import { endpoints } from '../utils/endpoints';
import { unwrapList } from '../utils/apiData';
import { getUser } from '../utils/factory';

const ORG_USERNAME_BLOCKLIST = new Set([
  'unnnigeria',
  'redcrossng',
  'redcross',
  'lawma',
  'unfcccnigeria',
  'unfccc',
]);

const isOrgAccount = (user) => {
  const username = String(user?.username || '').toLowerCase().trim();
  if (!username) return true;
  if (ORG_USERNAME_BLOCKLIST.has(username)) return true;
  if (username.includes('redcross') || username.includes('unfccc')) return true;
  return false;
};

const pickPopularUsers = (list) => {
  const me = getUser();
  const meId = me?.id != null ? String(me.id) : null;

  return (Array.isArray(list) ? list : [])
    .filter((user) => user && user.id != null)
    .filter((user) => !meId || String(user.id) !== meId)
    .filter((user) => !isOrgAccount(user))
    .filter((user) => String(user.first_name || user.username || '').trim().length > 0)
    .slice(0, 4);
};

const usePopularUsers = () => {
  return useQuery({
    queryKey: ['popularUsers'],
    queryFn: async () => {
      try {
        const data = await client.run(
          'get',
          `${endpoints.popularUsers}?limit=12`,
          {},
          true
        );
        return pickPopularUsers(unwrapList(data));
      } catch {
        // Fallback: plain users list, still filter out orgs / self
        const data = await client.run('get', endpoints.users, {}, true);
        return pickPopularUsers(unwrapList(data));
      }
    },
    refetchInterval: 300000,
    staleTime: 120000,
    retry: 1,
  });
};

export { usePopularUsers };
export default usePopularUsers;
