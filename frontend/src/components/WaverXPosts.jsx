import Posts from "./Posts";
import { usePostMutations } from "../hooks/usePostMutations";
import { useProfile } from "../hooks/useProfile";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";

const WaverXPosts = () => {
  const waverxId = import.meta.env.VITE_APP_WAVERX_ID || "";
  const [activities, setActivities] = useState([]);
  const {
    isPending,
    error,
    isFetched,
    data,
    user: waverxUser,
  } = useProfile(
    waverxId
      ? { user_id: waverxId }
      : { username: "waverx" }
  );

  useEffect(() => {
    if (isPending) {
      toast.dismiss();
      toast.info("Fetching WaverX Activities...", {
        autoClose: 200,
      });
    }
    if (isFetched && data) {
      setActivities(data.posts || []);
    }

    if (error) {
      toast.dismiss();
      console.error("WaverX Activities Error:", error);
      toast.error("Unable to fetch WaverX activities. The AI assistant may not be available yet.");
    }
  }, [isFetched, isPending, error, data]);

  const {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
    saveMutation,
    unsaveMutation,
  } = usePostMutations();

  const profileId = waverxUser?.id || data?.user?.id;

  return (
    <div>
      {profileId ? (
        <div className="px-3 py-2 border-b border-border mb-2">
          <Link
            to={`/app/${profileId}/profile`}
            className="text-sm font-medium text-primary hover:underline"
          >
            View Climate Wavers · WaverX profile
          </Link>
        </div>
      ) : null}
      {activities.length > 0 ? (
        <Posts
          posts={activities}
          type={"post"}
          postId={""}
          unlike={unlikeMutation}
          like={likeMutation}
          repost={repostMutation}
          unrepost={unrepostMutation}
          save={saveMutation}
          unsave={unsaveMutation}
        />
      ) : (
        <div className="p-6 text-center bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-gray-500 text-base">WaverX is ready to assist!</div>
          <div className="text-gray-400 text-sm mt-2">
            Verified alerts and climate tips will appear here
          </div>
          {profileId ? (
            <Link
              to={`/app/${profileId}/profile`}
              className="inline-block mt-3 text-sm text-primary hover:underline"
            >
              Open profile
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default WaverXPosts;
