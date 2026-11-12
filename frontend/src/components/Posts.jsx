import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import Accountcard from "./Accountcard";
import { client } from "../api";
import { endpoints } from "../utils/endpoints";
import { getAuthToken, getUser, secureMediaUrl } from "../utils/factory";
import { toast } from "react-toastify";
import { AiOutlineHeart, AiFillHeart, AiOutlineRetweet } from "react-icons/ai";
import { IoChatboxEllipsesOutline, IoEllipsisHorizontal, IoTrashOutline, IoEyeOutline } from "react-icons/io5";
import { PiBookmark, PiBookmarkFill } from "react-icons/pi";
import Modal from "./Modal";
import Createpost from "./Createpost";
import PropTypes from "prop-types";
import ImageLightbox from "./ImageLightbox";
import LinkifiedText from "./LinkifiedText";
import { postFontStyle } from "../utils/postFonts";

const Posts = ({
  type,
  posts,
  postId,
  unlike,
  like,
  repost,
  unrepost,
  save,
  unsave,
  isLoading = false,
  isError = false,
  onRetry,
}) => {
  const navigate = useNavigate();
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentId, setCommentId] = useState("");
  const [openMenuId, setOpenMenuId] = useState(null);
  const menuRef = useRef(null);
  const [localPosts, setLocalPosts] = useState([]);
  const [mediaPreview, setMediaPreview] = useState(null);

  useEffect(() => {
    if (!Array.isArray(posts)) {
      setLocalPosts([]);
      return;
    }
    setLocalPosts(posts.filter((post) => post && post.id));
  }, [posts]);

  // Posts data is managed by the database, no localStorage needed

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setOpenMenuId(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleOptimisticUpdate = (postId, changes) => {
    setLocalPosts((prevPosts) =>
      prevPosts.map((post) =>
        post.id === postId ? { ...post, ...changes } : post
      )
    );
  };

  const handleLike = (post) => {
    const updatedPost = { ...post, is_reacted: !post.is_reacted };
    if (updatedPost.is_reacted) {
      updatedPost.total_reactions += 1;
      handleOptimisticUpdate(post.id, updatedPost);
      like.mutate({ postType: type, post: post.id });
    } else {
      updatedPost.total_reactions -= 1;
      handleOptimisticUpdate(post.id, updatedPost);
      unlike.mutate({ postType: type, post: post.id });
    }
  };

  const handleRepost = (post) => {
    const updatedPost = { ...post, is_reposted: !post.is_reposted };
    if (updatedPost.is_reposted) {
      updatedPost.total_reposts += 1;
      handleOptimisticUpdate(post.id, updatedPost);
      repost.mutate({ postType: type, post: post.id });
    } else {
      updatedPost.total_reposts -= 1;
      handleOptimisticUpdate(post.id, updatedPost);
      unrepost.mutate({ postType: type, post: post.id });
    }
  };

  const handleSave = (post) => {
    const updatedPost = { ...post, is_bookmarked: !post.is_bookmarked };
    if (updatedPost.is_bookmarked) {
      updatedPost.total_bookmarks += 1;
      handleOptimisticUpdate(post.id, updatedPost);
      save.mutate({ postType: type, post: post.id });
    } else {
      updatedPost.total_bookmarks -= 1;
      handleOptimisticUpdate(post.id, updatedPost);
      unsave.mutate({ postType: type, post: post.id });
    }
  };

  const commentPage = (post) => {
    try {
      console.log('=== COMMENT PAGE CLICKED ===');
      console.log('Post:', post);
      console.log('Type:', type);
      console.log('PostId:', postId);
      
    if (type === "post") {
        const path = `/app/${post.id}/comments`;
        console.log('Navigating to:', path);
        navigate(path, {
        state: { post: post },
      });
    } else if (type === "comments") {
        const path = `/app/${postId}/${post.id}/comments`;
        console.log('Navigating to:', path);
        navigate(path, {
          state: { post: post },
        });
      }
    } catch (error) {
      console.error('Error in commentPage:', error);
      alert('Error navigating to comments: ' + error.message);
    }
  };

  const viewPostDetails = (post) => {
    try {
      console.log('=== VIEW POST DETAILS CLICKED ===');
      console.log('Post:', post);
      const path = `/app/post/${post.id}`;
      console.log('Navigating to:', path);
      navigate(path, {
        state: { post: post },
      });
    } catch (error) {
      console.error('Error in viewPostDetails:', error);
      alert('Error navigating to post details: ' + error.message);
    }
  };

  const deletePost = async (post) => {
    try {
      // Determine if this is a post or comment based on the type prop
      const isComment = type === "comments";
      const deleteUrl = isComment ? `${endpoints.comments}${post.id}/` : `${endpoints.post}${post.id}/`;
      const token = getAuthToken();
      
      if (!token) {
        toast.error('Authentication required to delete posts');
        return;
      }
      
      const response = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        // Remove post from local state immediately for better UX
        setLocalPosts(prevPosts => {
          const filtered = prevPosts.filter(p => p.id !== post.id);
          return filtered;
        });
        
        const itemType = isComment ? 'Comment' : 'Post';
        toast.success(`🗑️ ${itemType} deleted successfully!`, {
          position: "top-center",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          style: {
            background: '#10B981',
            color: 'white',
            fontWeight: 'bold'
          }
        });

        // If we're on a post detail page, redirect to home after deletion
        const currentPath = window.location.pathname;
        if (currentPath.includes('/post/') || 
            currentPath.includes(`/${post.id}/`) || 
            currentPath.includes(`/post/${post.id}`)) {
          setTimeout(() => {
            navigate('/app');
          }, 1000); // Small delay to show the success message
        }
      } else {
        const errorData = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorData}`);
      }
    } catch (error) {
      console.error('Delete post error:', error);
      
      const itemType = type === "comments" ? 'comment' : 'post';
      toast.error(`❌ Failed to delete ${itemType}: ${error.message}`, {
        position: "top-center",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        style: {
          background: '#EF4444',
          color: 'white',
          fontWeight: 'bold'
        }
      });
    }
  };

  const toggleMenu = (postId) => {
    setOpenMenuId(openMenuId === postId ? null : postId);
  };

  if (isLoading && localPosts.length === 0) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto" aria-busy="true" aria-live="polite">
        <p className="sr-only">Loading posts</p>
        {[0, 1, 2].map((item) => (
          <div key={item} className="border border-border bg-surface p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 shrink-0 bg-background" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-36 bg-background" />
                <div className="h-3 w-24 bg-background" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full bg-background" />
              <div className="h-3 w-4/5 bg-background" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError && localPosts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto border border-border bg-surface p-8 text-center">
        <p className="text-foreground font-medium">We could not load posts</p>
        <p className="mt-2 text-sm text-muted">Check your connection and try again.</p>
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex min-h-11 items-center justify-center px-4 bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-dark"
          >
            Try again
          </button>
        ) : null}
      </div>
    );
  }

  if (!isLoading && localPosts.length === 0) {
    return (
      <div className="max-w-4xl mx-auto border border-border bg-surface p-8 text-center">
        <p className="text-foreground font-medium">
          {type === "comments" ? "No comments yet" : "No posts yet"}
        </p>
        <p className="mt-2 text-sm text-muted">
          {type === "comments"
            ? "Be the first to share a comment on this post."
            : "Share a climate action update to start the feed."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {Array.isArray(localPosts) && localPosts.length > 0 ? (
        localPosts
          .filter(post => post && post.id)
          .sort((a, b) => {
            const dateA = new Date(a.created_at || a.date_created || 0);
            const dateB = new Date(b.created_at || b.date_created || 0);
            return dateB - dateA; // Newest first
          })
          .map((post) => (
          <div
            key={`${post?.user?.id || 'unknown'}_${post?.id || 'unknown'}`}
            className="bg-surface shadow-lg border border-border hover:shadow-xl transition-shadow duration-300 hover:border-primary/40 group"
          >
            {isCommentModalOpen && (
              <Modal closeFn={() => setIsCommentModalOpen(false)}>
                <Createpost
                  parentId={type === "comments" ? commentId : ""}
                  postId={type === "post" ? commentId : postId}
                  type="comments"
                  closeModal={() => setIsCommentModalOpen(false)}
                />
              </Modal>
            )}
            <div className="p-6 pb-4 flex items-center justify-between">
            <Accountcard user={post?.user} />
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => toggleMenu(post.id)}
                  className="p-2 sm:p-3 rounded-full hover:bg-gray-100 transition-all duration-200 group"
                  aria-label="Post options"
                >
                  <IoEllipsisHorizontal className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 group-hover:text-gray-700 transition-colors" />
                </button>
                
                {openMenuId === post.id && (
                  <div className="absolute right-0 top-10 sm:top-12 bg-white rounded-xl shadow-xl border border-gray-200 py-2 z-50 min-w-[180px] sm:min-w-[200px] max-w-[250px]">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('=== VIEW DETAILS BUTTON CLICKED ===');
                        console.log('Post:', post);
                        viewPostDetails(post);
                        setOpenMenuId(null);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-150 group"
                    >
                      <IoEyeOutline className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 group-hover:text-blue-600" />
                      <span className="text-sm sm:text-base font-medium">View Details</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('=== VIEW COMMENTS BUTTON CLICKED ===');
                        console.log('Post:', post);
                        commentPage(post);
                        setOpenMenuId(null);
                      }}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 active:bg-gray-100 flex items-center space-x-3 text-gray-700 transition-colors duration-150 group"
                    >
                      <IoChatboxEllipsesOutline className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 group-hover:text-green-600" />
                      <span className="text-sm sm:text-base font-medium">View Comments</span>
                    </button>
                    {(() => {
                      try {
                        // Use proper getUser() function instead of localStorage
                        const currentUser = getUser();
                        
                        // Check if user is logged in
                        const isLoggedIn = !!currentUser?.id;
                        
                        // Get user ID from proper source
                        const userId = currentUser?.id;
                        
                        // Check if we can match by email or other fields
                        const userEmail = currentUser?.email;
                        const postUserEmail = post?.user?.email;
                        
                        // Check if this is the user's own post
                        // Since we have different user systems, we'll use email matching for now
                        const isOwnPost = userEmail === postUserEmail;
                        
                        // Handle different scenarios
                        if (!isLoggedIn) {
                            return false; // Don't show delete if not logged in
                        }
                        
                        if (isOwnPost) {
                            return true; // Show delete for own posts
                        }
                        
                        return false; // Don't show delete for other users' posts
                      } catch (error) {
                        console.error('Error parsing user from localStorage:', error);
                        return false; // Don't show delete if there's an error
                      }
                    })() && (
                      <>
                        <div className="border-t border-gray-100 my-1"></div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            
                            const itemType = type === "comments" ? 'comment' : 'post';
                            const itemTypeCapitalized = type === "comments" ? 'Comment' : 'Post';
                            const confirmed = window.confirm(
                              `🗑️ Delete ${itemTypeCapitalized}\n\n` +
                              `Are you sure you want to delete this ${itemType}?\n` +
                              'This action cannot be undone.\n\n' +
                              `Click OK to delete or Cancel to keep the ${itemType}.`
                            );
                            if (confirmed) {
                              deletePost(post);
                              setOpenMenuId(null);
                            }
                          }}
                          className="w-full px-4 py-3 text-left hover:bg-red-50 active:bg-red-100 flex items-center space-x-3 text-red-600 transition-colors duration-150 group"
                        >
                          <IoTrashOutline className="w-4 h-4 sm:w-5 sm:h-5 text-red-500 group-hover:text-red-600" />
                          <span className="text-sm sm:text-base font-medium">
                            Delete {type === "comments" ? "Comment" : "Post"}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Date/Time and Location Display */}
            <div className="px-6 pb-2">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 001.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>{formatDistanceToNow(new Date(post?.created_at), { addSuffix: true })}</span>
                  </div>
                  
                  {post?.location && (
                    <div className="flex items-center space-x-2 text-sm text-blue-600">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">{post.location}</span>
                    </div>
                  )}
                </div>
                
                {post?.location && (
                  <div className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full border border-blue-200">
                    📍 Location Shared
                  </div>
                )}
              </div>
            </div>
            
            <button onClick={() => commentPage(post)} className="w-full text-left group-hover:bg-gray-50/50 transition-colors duration-200">
              <div className="px-6 pb-4">
              <p
                className="text-foreground text-lg leading-relaxed font-medium transition-colors duration-200"
                style={postFontStyle(post?.font_family)}
              >
                <LinkifiedText
                  text={post?.content || ""}
                  linkClassName="text-primary font-semibold underline underline-offset-2 break-all hover:text-primary-dark"
                  hashtagClassName="text-primary font-semibold hover:text-primary-dark transition-colors duration-200"
                />
              </p>
              {(post?.image || post?.video) && (
                  <div
                    className={`mt-4 grid gap-2 ${
                      post?.image && post?.video ? "grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    {post?.image && (
                      <div
                        role="button"
                        tabIndex={0}
                        className="overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center max-h-[min(70vh,520px)] shadow-md group-hover:shadow-lg transition-shadow duration-300 cursor-zoom-in"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMediaPreview({
                            type: "image",
                            src: secureMediaUrl(post.image),
                            alt: "Post image",
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setMediaPreview({
                              type: "image",
                              src: secureMediaUrl(post.image),
                              alt: "Post image",
                            });
                          }
                        }}
                        aria-label="Preview image"
                      >
                        <img
                          className="w-full max-h-[min(70vh,520px)] object-contain pointer-events-none"
                          src={secureMediaUrl(post.image)}
                          alt="Post content"
                        />
                      </div>
                    )}
                    {post?.video && (
                      <div
                        role="button"
                        tabIndex={0}
                        className="relative overflow-hidden rounded-xl bg-gray-100 flex items-center justify-center max-h-[min(70vh,520px)] shadow-md group-hover:shadow-lg transition-shadow duration-300 cursor-zoom-in text-left"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setMediaPreview({
                            type: "video",
                            src: secureMediaUrl(post.video),
                            alt: "Post video",
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            setMediaPreview({
                              type: "video",
                              src: secureMediaUrl(post.video),
                              alt: "Post video",
                            });
                          }
                        }}
                        aria-label="Preview video"
                      >
                        <video
                          className="w-full max-h-[min(70vh,520px)] object-contain pointer-events-none"
                          preload="metadata"
                          playsInline
                          muted
                        >
                          <source src={secureMediaUrl(post.video)} type="video/mp4" />
                          Your browser does not support the video tag.
                        </video>
                        <span className="absolute inset-0 flex items-center justify-center bg-black/20 pointer-events-none">
                          <span className="rounded-full bg-black/60 text-white text-xs font-medium px-3 py-1.5">
                            Play preview
                          </span>
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {post?.audio && (
                  <div className="mt-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 group-hover:shadow-lg transition-shadow duration-300">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-[#067d83] rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.808L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4-3.808a1 1 0 011.617.808zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.983 5.983 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.984 3.984 0 00-1.172-2.828 1 1 0 010-1.415z" clipRule="evenodd" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            Audio Recording
                          </p>
                          <p className="text-xs text-gray-500">
                            Click to play
                          </p>
                        </div>
                        <audio
                          className="flex-1"
                          controls
                          preload="metadata"
                          src={secureMediaUrl(post.audio)}
                        >
                          <source src={secureMediaUrl(post.audio)} type="audio/mpeg" />
                          <source src={secureMediaUrl(post.audio)} type="audio/wav" />
                          <source src={secureMediaUrl(post.audio)} type="audio/ogg" />
                          Your browser does not support the audio element.
                        </audio>
                      </div>
                    </div>
                  </div>
                )}
                
              </div>
            </button>
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/30">
              <Link onClick={() => setIsCommentModalOpen(true)}>
                <button
                  className="flex items-center space-x-2 px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-all duration-200 group/btn"
                  onClick={() => {
                    setIsCommentModalOpen(true);
                    setCommentId(post.id);
                  }}
                >
                  <IoChatboxEllipsesOutline 
                    size={20} 
                    className="text-gray-500 group-hover/btn:text-blue-500 transition-colors duration-200" 
                  />
                  <span className="text-sm font-medium text-gray-500 group-hover/btn:text-blue-500 transition-colors duration-200">
                    {post?.total_comments || 0}
                  </span>
                </button>
              </Link>
              
              <button
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl hover:bg-red-50 transition-all duration-200 group/btn"
                onClick={() => handleLike(post)}
              >
                {post?.is_reacted ? (
                  <AiFillHeart
                    size={20}
                    className="text-red-500 transition-all duration-200 group-hover/btn:scale-110"
                  />
                ) : (
                  <AiOutlineHeart
                    size={20}
                    className="text-gray-500 group-hover/btn:text-red-500 transition-all duration-200 group-hover/btn:scale-110"
                  />
                )}
                <span className={`text-sm font-medium transition-colors duration-200 ${
                  post?.is_reacted ? 'text-red-500' : 'text-gray-500 group-hover/btn:text-red-500'
                }`}>
                  {post?.total_reactions || 0}
                </span>
              </button>
              
              <button
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl hover:bg-green-50 transition-all duration-200 group/btn"
                onClick={() => handleRepost(post)}
              >
                <AiOutlineRetweet
                  size={20}
                  className={`transition-all duration-200 group-hover/btn:scale-110 ${
                    post?.is_reposted 
                      ? 'text-green-500' 
                      : 'text-gray-500 group-hover/btn:text-green-500'
                  }`}
                />
                <span className={`text-sm font-medium transition-colors duration-200 ${
                  post?.is_reposted ? 'text-green-500' : 'text-gray-500 group-hover/btn:text-green-500'
                }`}>
                  {post?.total_reposts || 0}
                </span>
              </button>
              
              <button
                className="flex items-center space-x-2 px-4 py-2.5 rounded-xl hover:bg-teal-50 transition-all duration-200 group/btn"
                onClick={() => handleSave(post)}
              >
                {post?.is_bookmarked ? (
                  <PiBookmarkFill
                    size={20}
                    className="text-teal-500 transition-all duration-200 group-hover/btn:scale-110"
                  />
                ) : (
                  <PiBookmark
                    size={20}
                    className="text-gray-500 group-hover/btn:text-teal-500 transition-all duration-200 group-hover/btn:scale-110"
                  />
                )}
                <span className={`text-sm font-medium transition-colors duration-200 ${
                  post?.is_bookmarked ? 'text-teal-500' : 'text-gray-500 group-hover/btn:text-teal-500'
                }`}>
                  {post?.total_bookmarks || 0}
                </span>
              </button>
              
            </div>
          </div>
        ))
      ) : null}
      {mediaPreview?.src ? (
        <ImageLightbox
          src={mediaPreview.src}
          alt={mediaPreview.alt}
          type={mediaPreview.type || "image"}
          onClose={() => setMediaPreview(null)}
        />
      ) : null}
    </div>
  );
};

Posts.propTypes = {
  posts: PropTypes.array.isRequired,
  type: PropTypes.string.isRequired,
  postId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  unlike: PropTypes.object.isRequired,
  like: PropTypes.object.isRequired,
  repost: PropTypes.object.isRequired,
  unrepost: PropTypes.object.isRequired,
  save: PropTypes.object.isRequired,
  unsave: PropTypes.object.isRequired,
  isLoading: PropTypes.bool,
  isError: PropTypes.bool,
  onRetry: PropTypes.func,
};

export default Posts;
