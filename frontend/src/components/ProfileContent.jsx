import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AiOutlineHeart, AiFillHeart, AiOutlineRetweet } from "react-icons/ai";
import { IoChatboxEllipsesOutline } from "react-icons/io5";
import { PiBookmark, PiBookmarkFill } from "react-icons/pi";
import { BsBarChart } from "react-icons/bs";
import { formatDistanceToNow } from "date-fns";
import PropTypes from "prop-types";
import { avatarUrl, secureMediaUrl } from "../utils/factory";
import LinkifiedText from "./LinkifiedText";
import { postFontStyle } from "../utils/postFonts";
import PostOwnerMenu from "./PostOwnerMenu";
import PostEditPanel from "./PostEditPanel";
import PostMediaViewer from "./PostMediaViewer";
import { parsePostImages } from "../utils/postMedia";

const PostImageFallback = ({ image, alt = "Post image", className = "" }) => {
  const urls = parsePostImages(image);
  if (!urls.length) return null;
  return (
    <img
      src={secureMediaUrl(urls[0])}
      alt={alt}
      className={className}
    />
  );
};

const ProfileContent = ({ content, type, onLike, onUnlike, onRepost, onUnrepost, onSave, onUnsave }) => {
  const navigate = useNavigate();
  const [isLiked, setIsLiked] = useState(false);
  const [isReposted, setIsReposted] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [localContent, setLocalContent] = useState(content);
  const [hidden, setHidden] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    // Set initial states based on content
    if (content) {
      setLocalContent(content);
      setIsLiked(content.is_reacted || false);
      setIsReposted(content.is_reposted || false);
      setIsBookmarked(content.is_bookmarked || false);
      setHidden(false);
      setEditing(false);
    }
  }, [content]);

  const handleLike = () => {
    if (isLiked) {
      onUnlike && onUnlike({ postType: type, post: content.id });
      setIsLiked(false);
    } else {
      onLike && onLike({ postType: type, post: content.id });
      setIsLiked(true);
    }
  };

  const handleRepost = () => {
    if (isReposted) {
      onUnrepost && onUnrepost({ postType: type, post: content.id });
      setIsReposted(false);
    } else {
      onRepost && onRepost({ postType: type, post: content.id });
      setIsReposted(true);
    }
  };

  const handleBookmark = () => {
    if (isBookmarked) {
      onUnsave && onUnsave({ postType: type, post: content.id });
      setIsBookmarked(false);
    } else {
      onSave && onSave({ postType: type, post: content.id });
      setIsBookmarked(true);
    }
  };

  const startEdit = () => {
    setEditing(true);
  };

  const handleEditSaved = (updated) => {
    setLocalContent((prev) => ({
      ...prev,
      content: updated?.content ?? prev?.content,
      hashtags: updated?.hashtags ?? prev?.hashtags,
      font_family: updated?.font_family ?? prev?.font_family,
      image: updated?.image ?? "",
      video: updated?.video ?? "",
      audio: updated?.audio ?? "",
      location: updated?.location ?? "",
    }));
    setEditing(false);
  };

  const renderContent = () => {
    if (!localContent || hidden) return null;
    const content = localContent;

    switch (type) {
      case "post":
        return (
          <div className="bg-surface rounded-2xl shadow-lg border border-border hover:shadow-xl transition-all duration-300 hover:border-primary/30 group">
            <div className="p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center space-x-3 min-w-0">
                  <img
                    src={avatarUrl(content.user)}
                    alt={content.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-border"
                  />
                  <div className="min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate">{content.user?.first_name} {content.user?.last_name}</h3>
                    <p className="text-sm text-muted truncate">@{content.user?.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm text-muted bg-surface-muted px-3 py-1" style={{ borderRadius: 5 }}>
                    {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                  </span>
                  <PostOwnerMenu
                    item={content}
                    itemType="post"
                    onViewDetails={(item) => navigate(`/app/post/${item.id}`, { state: { post: item } })}
                    onViewComments={(item) => navigate(`/app/${item.id}/comments`, { state: { post: item } })}
                    onEdit={startEdit}
                    onDeleted={() => setHidden(true)}
                  />
                </div>
              </div>
              
              <div className="mb-6">
                {editing ? (
                  <PostEditPanel
                    item={content}
                    itemType={type === "comments" ? "comments" : "post"}
                    onCancel={() => setEditing(false)}
                    onSaved={handleEditSaved}
                  />
                ) : (
                <p
                  className="text-foreground text-base leading-relaxed"
                  style={postFontStyle(content.font_family)}
                >
                  <LinkifiedText text={content.content || ""} />
                </p>
                )}
                
                {!editing && (content.image || content.video) ? (
                  <PostMediaViewer image={content.image} video={content.video} />
                ) : null}
                
                {!editing && content.audio && (
                  <div className="mt-4">
                    <audio
                      src={content.audio}
                      controls
                      className="w-full"
                    >
                      Your browser does not support the audio tag.
                    </audio>
                  </div>
                )}
                
                {!editing && content.location && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
                    <div className="flex items-center space-x-2">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 rounded-full">
                        <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-blue-900">Location</p>
                        <p className="text-sm text-blue-700">{content.location}</p>
                      </div>
                      <div className="text-xs text-blue-500 bg-blue-100 px-2 py-1 rounded-full">
                        📍 Shared
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-8">
                  <button
                    onClick={handleLike}
                    className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-all duration-200 hover:scale-110"
                  >
                    {isLiked ? <AiFillHeart className="text-red-500" size={22} /> : <AiOutlineHeart size={22} />}
                    <span className="font-medium">{content.total_reactions || 0}</span>
                  </button>
                  
                  <button
                    onClick={() => navigate(`/app/${content.id}/comments`)}
                    className="flex items-center space-x-2 text-gray-500 hover:text-blue-500 transition-all duration-200 hover:scale-110"
                  >
                    <IoChatboxEllipsesOutline size={22} />
                    <span className="font-medium">{content.total_comments || 0}</span>
                  </button>
                  
                  <button
                    onClick={handleRepost}
                    className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-all duration-200 hover:scale-110"
                  >
                    {isReposted ? <AiOutlineRetweet className="text-green-500" size={22} /> : <AiOutlineRetweet size={22} />}
                    <span className="font-medium">{content.total_reposts || 0}</span>
                  </button>
                  
                  <button
                    onClick={handleBookmark}
                    className="flex items-center space-x-2 text-gray-500 hover:text-yellow-500 transition-all duration-200 hover:scale-110"
                  >
                    {isBookmarked ? <PiBookmarkFill className="text-yellow-500" size={22} /> : <PiBookmark size={22} />}
                    <span className="font-medium">{content.total_bookmarks || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "comment":
        console.log("Rendering comment:", content);
        console.log("Comment content:", content.content);
        console.log("Comment user:", content.user);
        console.log("Comment post:", content.post);
        console.log("Comment post_id:", content.post_id);
        console.log("Full comment object keys:", Object.keys(content));
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-gray-200 group">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={avatarUrl(content.user)}
                    alt={content.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{content.user?.first_name} {content.user?.last_name}</h3>
                    <p className="text-sm text-gray-500">@{content.user?.username}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-4">
                  <p className="text-sm text-blue-600 font-medium mb-2">💬 Comment on:</p>
                  {content.post ? (
                    <div className="bg-white p-3 rounded border">
                      <div className="flex items-center space-x-2 mb-2">
                        <img
                          src={avatarUrl(content.post?.user)}
                          alt={content.post.user?.username}
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span className="text-sm font-medium text-gray-900">{content.post.user?.first_name} {content.post.user?.last_name}</span>
                        <span className="text-xs text-gray-500">@{content.post.user?.username}</span>
                      </div>
                      <p
                        className="text-foreground text-sm"
                        style={postFontStyle(content.post?.font_family)}
                      >
                        <LinkifiedText text={content.post?.content || ""} />
                      </p>
                      
                      {/* Show original post attachments */}
                      {content.post.image ? (
                        <div className="mt-2">
                          <PostImageFallback
                            image={content.post.image}
                            alt="Original post image"
                            className="rounded-lg max-w-full h-32 object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="bg-white p-3 rounded border">
                      <p className="text-gray-600 text-sm italic">Original post not available</p>
                      <p className="text-xs text-gray-500 mt-1">Post ID: {content.post_id || 'Unknown'}</p>
                    </div>
                  )}
                </div>
                
                <div className="mb-4">
                  <p
                  className="text-foreground text-base leading-relaxed"
                  style={postFontStyle(content.font_family)}
                >
                  <LinkifiedText text={content.content || ""} />
                </p>
                  
                  {(content.image || content.video) ? (
                    <PostMediaViewer image={content.image} video={content.video} />
                  ) : null}
                  
                  {content.audio && (
                    <div className="mt-3">
                      <audio
                        src={content.audio}
                        controls
                        className="w-full"
                      >
                        Your browser does not support the audio tag.
                      </audio>
                    </div>
                  )}
                  
                  {content.location && (
                    <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-center w-6 h-6 bg-green-100 rounded-full">
                          <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium text-green-900">Comment Location</p>
                          <p className="text-xs text-green-700">{content.location}</p>
                        </div>
                        <div className="text-xs text-green-500 bg-green-100 px-2 py-1 rounded-full">
                          📍
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-8">
                  <button
                    onClick={handleLike}
                    className="flex items-center space-x-2 text-gray-500 hover:text-red-500 transition-all duration-200 hover:scale-110"
                  >
                    {isLiked ? <AiFillHeart className="text-red-500" size={22} /> : <AiOutlineHeart size={22} />}
                    <span className="font-medium">{content.total_reactions || 0}</span>
                  </button>
                  
                  <button
                    onClick={handleRepost}
                    className="flex items-center space-x-2 text-gray-500 hover:text-green-500 transition-all duration-200 hover:scale-110"
                  >
                    {isReposted ? <AiOutlineRetweet className="text-green-500" size={22} /> : <AiOutlineRetweet size={22} />}
                    <span className="font-medium">{content.total_reposts || 0}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );

      case "repost":
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-gray-200 group">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={avatarUrl(content.user)}
                    alt={content.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{content.user?.first_name} {content.user?.last_name}</h3>
                    <p className="text-sm text-gray-500">@{content.user?.username}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="bg-green-50 border-l-4 border-green-400 p-4 rounded-lg mb-4">
                  <p className="text-sm text-green-600 font-medium mb-2">🔄 Reposted:</p>
                  {content.post && (
                    <div className="bg-white p-4 rounded border">
                      <div className="flex items-center space-x-3 mb-3">
                        <img
                          src={avatarUrl(content.post?.user)}
                          alt={content.post.user?.username}
                          className="w-8 h-8 rounded-full object-cover"
                        />
                        <div>
                          <h4 className="font-semibold text-gray-900">{content.post.user?.first_name} {content.post.user?.last_name}</h4>
                          <p className="text-sm text-gray-500">@{content.post.user?.username}</p>
                        </div>
                      </div>
                      <p
                        className="text-foreground"
                        style={postFontStyle(content.post?.font_family)}
                      >
                        <LinkifiedText text={content.post?.content || ""} />
                      </p>
                      {content.post.image || content.post.video ? (
                        <PostMediaViewer
                          image={content.post.image}
                          video={content.post.video}
                        />
                      ) : null}
                      
                      {content.post.location && (
                        <div className="mt-3 p-2 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center justify-center w-5 h-5 bg-purple-100 rounded-full">
                              <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-purple-900">Reposted from</p>
                              <p className="text-xs text-purple-700">{content.post.location}</p>
                            </div>
                            <div className="text-xs text-purple-500 bg-purple-100 px-2 py-1 rounded-full">
                              📍
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "bookmark":
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-gray-200 group">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={avatarUrl(content.post?.user)}
                    alt={content.post?.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{content.post?.user?.first_name} {content.post?.user?.last_name}</h3>
                    <p className="text-sm text-gray-500">@{content.post?.user?.username}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg mb-4">
                  <p className="text-sm text-yellow-600 font-medium mb-2">🔖 Bookmarked:</p>
                  <p
                    className="text-foreground text-base leading-relaxed"
                    style={postFontStyle(content.post?.font_family)}
                  >
                    {content.post?.content}
                  </p>
                  {(content.post?.image || content.post?.video) && (
                    <div className="mt-3">
                      <PostMediaViewer
                        image={content.post.image}
                        video={content.post.video}
                      />
                      
                      {content.post.location && (
                        <div className="mt-3 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-100">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center justify-center w-5 h-5 bg-yellow-100 rounded-full">
                              <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-yellow-900">Bookmarked from</p>
                              <p className="text-xs text-yellow-700">{content.post.location}</p>
                            </div>
                            <div className="text-xs text-yellow-500 bg-yellow-100 px-2 py-1 rounded-full">
                              📍
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "reaction":
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-gray-200 group">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={avatarUrl(content.post?.user)}
                    alt={content.post?.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{content.post?.user?.first_name} {content.post?.user?.last_name}</h3>
                    <p className="text-sm text-gray-500">@{content.post?.user?.username}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="bg-red-50 border-l-4 border-red-400 p-4 rounded-lg mb-4">
                  <p className="text-sm text-red-600 font-medium mb-2">❤️ Liked:</p>
                  <p
                    className="text-foreground text-base leading-relaxed"
                    style={postFontStyle(content.post?.font_family)}
                  >
                    {content.post?.content}
                  </p>
                  {(content.post?.image || content.post?.video) && (
                    <div className="mt-3">
                      <PostMediaViewer
                        image={content.post.image}
                        video={content.post.video}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      case "poll":
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 hover:shadow-xl transition-all duration-300 hover:border-gray-200 group">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={avatarUrl(content.user)}
                    alt={content.user?.username}
                    className="w-12 h-12 rounded-full object-cover ring-2 ring-gray-100"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{content.user?.first_name} {content.user?.last_name}</h3>
                    <p className="text-sm text-gray-500">@{content.user?.username}</p>
                  </div>
                </div>
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  {formatDistanceToNow(new Date(content.created_at), { addSuffix: true })}
                </span>
              </div>
              
              <div className="mb-6">
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg mb-4">
                  <div className="flex items-center space-x-2 mb-3">
                    <BsBarChart size={20} className="text-blue-500" />
                    <span className="text-blue-600 font-medium">📊 Poll</span>
                  </div>
                  <p className="text-gray-900 text-base leading-relaxed mb-4">{content.question}</p>
                  
                  {content.options && content.options.length > 0 && (
                    <div className="space-y-3">
                      {content.options.map((option, index) => (
                        <div key={index} className="p-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 transition-colors">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-900 font-medium">{option}</span>
                            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded-full">0 votes</span>
                          </div>
                        </div>
                      ))}
                      
                      {content.post.location && (
                        <div className="mt-3 p-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-100">
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center justify-center w-5 h-5 bg-red-100 rounded-full">
                              <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-medium text-red-900">Liked from</p>
                              <p className="text-xs text-red-700">{content.post.location}</p>
                            </div>
                            <div className="text-xs text-red-500 bg-red-100 px-2 py-1 rounded-full">
                              📍
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
            <p className="text-gray-500">Unknown content type: {type}</p>
          </div>
        );
    }
  };

  return renderContent();
};

ProfileContent.propTypes = {
  content: PropTypes.object,
  type: PropTypes.string.isRequired,
  onLike: PropTypes.func,
  onUnlike: PropTypes.func,
  onRepost: PropTypes.func,
  onUnrepost: PropTypes.func,
  onSave: PropTypes.func,
  onUnsave: PropTypes.func,
};

export default ProfileContent;
