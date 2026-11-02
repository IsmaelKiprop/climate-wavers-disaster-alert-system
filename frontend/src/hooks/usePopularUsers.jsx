import { useQuery } from '@tanstack/react-query';
import { client } from '../api';
import { endpoints } from '../utils/endpoints';
import { unwrapList } from '../utils/apiData';

const usePopularUsers = () => {
  return useQuery({
    queryKey: ['popularUsers'],
    queryFn: async () => {
      const data = await client.run("get", endpoints.users, {}, true);
      return unwrapList(data);
    },
    refetchInterval: 300000,
    staleTime: 120000,
    retry: 1,
  });
};

export { usePopularUsers };
export default usePopularUsers;
