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

const pickPopularUsers = (list, limit = 4) => {
  const me = getUser();
  const meId = me?.id != null ? String(me.id) : null;

  return (Array.isArray(list) ? list : [])
    .filter((user) => user && user.id != null)
    .filter((user) => !meId || String(user.id) !== meId)
    .filter((user) => !isOrgAccount(user))
    .filter((user) => String(user.first_name || user.username || '').trim().length > 0)
    .slice(0, limit);
};

const usePopularUsers = (options = {}) => {
  const limit = options.limit ?? 4;
  const fetchLimit = Math.max(limit, 12);

  return useQuery({
    queryKey: ['popularUsers', limit],
    queryFn: async () => {
      try {
        const data = await client.run(
          'get',
          `${endpoints.popularUsers}?limit=${fetchLimit}`,
          {},
          true
        );
        return pickPopularUsers(unwrapList(data), limit);
      } catch {
        // Fallback: plain users list, still filter out orgs / self
        const data = await client.run('get', endpoints.users, {}, true);
        return pickPopularUsers(unwrapList(data), limit);
      }
    },
    refetchInterval: 300000,
    staleTime: 120000,
    retry: 1,
  });
};

export { usePopularUsers };
export default usePopularUsers;
