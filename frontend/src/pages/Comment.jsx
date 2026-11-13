import Postcomponent from "../components/Postcomponent";
import PropTypes from "prop-types";
import { useParams } from "react-router-dom";
import CommentPost from "../components/CommentPost";
import Createcomment from "../components/Createcomment";
import { useQueryClient } from "@tanstack/react-query";

const Comment = ({ type }) => {
  const { postId, commentId } = useParams();
  const queryClient = useQueryClient();

  const handleCommentSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ["posts"] });
    queryClient.invalidateQueries({ queryKey: ["post"] });
  };

  return (
    <div className="mx-auto w-full max-w-4xl text-left">
      <CommentPost type={type} postId={commentId ? commentId : postId} />

      <div className="border-t border-border bg-surface px-3 py-3 md:px-4">
        <Createcomment
          type="comments"
          postId={postId}
          parentId={commentId}
          button="Post"
          onSuccess={handleCommentSuccess}
        />
      </div>

      <div className="border-t border-border bg-surface px-2 py-3 md:px-3 md:py-4">
        <Postcomponent type="comments" postId={postId} comment={commentId} />
      </div>
    </div>
  );
};

Comment.propTypes = {
  type: PropTypes.string,
};

export default Comment;
