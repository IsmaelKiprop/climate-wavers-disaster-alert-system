import Accountcard from "./Accountcard";
import { AiFillHeart } from "react-icons/ai";
import { IoChatboxEllipses } from "react-icons/io5";
import { PiBookmarkFill } from "react-icons/pi";
import { Link } from "react-router-dom";
import { FaDonate } from "react-icons/fa";
import { RiAlarmWarningFill } from "react-icons/ri";
import PropTypes from "prop-types";
import LinkifiedText from "./LinkifiedText";

export const DisaxPostCard = ({ post }) => {
  const postUser = {
    image: "",
    username: post.username || "waverx",
    first_name: "WaverX",
    last_name: "Climate Wavers",
    id: post.userId || post.user_id || post.user?.id,
    userId: post.userId || post.user_id || post.user?.id,
    is_verified: true,
    profession: "Climate & disaster assistant · Climate Wavers",
  };
  // const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="disaster-post-card border-b-[1px] border-gray-700 py-4">
      <Accountcard user={postUser} />
      <div>
        <p className="text-left text-sm px-3 my-3">
          <LinkifiedText text={post.body || ""} />
        </p>
        {post.image && (
          <div className="px-3 overflow-hidden flex items-center justify-center max-h-[min(70vh,520px)] bg-gray-100">
            <img
              className="w-full max-h-[min(70vh,520px)] object-contain"
              src={post.image}
              alt=""
            />
          </div>
        )}
      </div>
      <div className="flex flex-row justify-between px-3 mt-2 ">
        <div className="flex flex-row items-center  ">
          {post.isAlert ? (
            <RiAlarmWarningFill color="red" />
          ) : (
            <AiFillHeart size={18} />
          )}
        </div>
        <div className="flex flex-row items-center">
          <FaDonate size={18} />
          <p className="text-xs ml-1 ">{post.comments_count}</p>
        </div>
        <Link>
          <div
            className="flex flex-row items-center  "
            // onClick={() => setIsModalopen(true)}
          >
            <IoChatboxEllipses size={18} />
            <p className="text-xs ml-1 ">{post.comments_count}</p>
          </div>
        </Link>
        <div
          className="flex flex-row items-center"
          // onClick={() => {
          //   post.is_saved
          //     ? unsaveMutation.mutate(post.id)
          //     : saveMutation.mutate(post.id);
          // }}
        >
          <PiBookmarkFill
            size={18}
            color={post.is_saved ? "rgb(0 128 128 / 1)" : ""}
          />
          <p className="text-xs ml-1 ">{post.savers_count}</p>
        </div>
      </div>
    </div>
  );
};

DisaxPostCard.propTypes = {
  post: PropTypes.shape({
    username: PropTypes.string.isRequired,
    userId: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
    comments_count: PropTypes.number,
    savers_count: PropTypes.number,
    is_saved: PropTypes.bool,
    isAlert: PropTypes.bool,
    body: PropTypes.string,
    image: PropTypes.string,
  }),
};
