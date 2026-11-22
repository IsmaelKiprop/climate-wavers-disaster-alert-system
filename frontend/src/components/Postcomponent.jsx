import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Posts from "./Posts";
import Pagination from "./Pagination";
import { toast } from "react-toastify";
import { useFetchPosts } from "../hooks/useFetchPosts";
import { usePostMutations } from "../hooks/usePostMutations";

const Postcomponent = ({ type, postId, comment, itemsPerPage = 10 }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const { data, error, isLoading, isFetching, refetch } = useFetchPosts({
    type,
    postId,
    comment,
    page: currentPage,
    pageSize: itemsPerPage,
  });

  const posts = data?.results || [];
  const totalItems = data?.count || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const fromCache = Boolean(data?._fromCache);
  const cacheAge = data?._cacheAge;

  const {
    likeMutation,
    unlikeMutation,
    repostMutation,
    unrepostMutation,
    saveMutation,
    unsaveMutation,
  } = usePostMutations();

  useEffect(() => {
    if (error && !fromCache && posts.length === 0) {
      toast.dismiss();
      toast.error("We could not load posts. Please try again.");
    }
  }, [error, fromCache, posts.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [currentPage, totalPages]);

  const isComments = type === "comments";

  return (
    <div className={isComments ? "space-y-3" : "space-y-6"}>
      {fromCache && posts.length > 0 ? (
        <p className="text-xs text-muted px-1">
          Showing cached posts
          {cacheAge ? ` from ${cacheAge}` : ""}.{" "}
          {typeof navigator !== "undefined" && !navigator.onLine
            ? "You're offline — new posts will appear when you're back online."
            : "Refreshing when a connection is available."}
        </p>
      ) : null}
      <Posts
        posts={posts}
        type={type}
        postId={postId}
        unlike={unlikeMutation}
        like={likeMutation}
        repost={repostMutation}
        unrepost={unrepostMutation}
        save={saveMutation}
        unsave={unsaveMutation}
        isLoading={isLoading || (isFetching && posts.length === 0)}
        isError={Boolean(error) && posts.length === 0 && !fromCache}
        onRetry={() => refetch()}
      />

      {totalPages > 1 && (
        <div className={isComments ? "mt-4" : "mt-8"}>
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            className="justify-center"
          />
        </div>
      )}
    </div>
  );
};

Postcomponent.propTypes = {
  type: PropTypes.string,
  comment: PropTypes.string,
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  itemsPerPage: PropTypes.number,
};

export default Postcomponent;
