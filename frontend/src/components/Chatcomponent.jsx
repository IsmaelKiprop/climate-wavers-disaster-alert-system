import { useRef, useState, useEffect } from "react";
import MessageCard from "./message-card";
import PropTypes from "prop-types";
import NewChat from "./NewChat";
import ChatInput from "./ChatInput";

const Chatcomponent = ({
  messages,
  handlePostMessage,
  handleCreateChat,
  current,
}) => {
  const bodyRef = useRef();
  const [newCurrent, setCurrent] = useState(current);
  const messageListRef = useRef(null); // Ref for the message list

  useEffect(() => {
    setCurrent(current);
  }, [current]);

  useEffect(() => {
    // Scroll to the last message when messages update
    if (messageListRef.current) {
      messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    }
  }, [messages]);

  const handleClick = async (body) => {
    const newChat = await handleCreateChat();
    setCurrent(newChat.id);

    await handlePostMessage(body, newChat.id);
  };

  return (
    <div className="max-h-fit h-full max-sm:h-[97%] max-sm:w-[90vw] flex flex-col justify-between">
      <div
        className="overflow-y-auto mt-4 message-card-list"
        ref={messageListRef}
        style={{ maxHeight: "calc(100vh - 200px)" }} // Adjust height based on your layout
      >
        {!messages?.length ? (
          <NewChat handleClick={handleClick} />
        ) : (
          messages.map((m) => (
            <MessageCard
              postedBy={m.postedBy}
              key={m.id || m.remoteId || `${m.postedAt}-${m.body}`}
              body={m.body}
              postedAt={m.postedAt}
            />
          ))
        )}
      </div>
      {newCurrent ? (
        <ChatInput
          body={bodyRef}
          handleClick={() => {
            handlePostMessage(bodyRef.current?.value);
            bodyRef.current.value = "";
          }}
        />
      ) : (
        <div className="">
          <ChatInput body={bodyRef} handleClick={handleClick} />
        </div>
      )}
    </div>
  );
};

Chatcomponent.propTypes = {
  messages: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      body: PropTypes.string,
      createdAt: PropTypes.oneOfType([
        PropTypes.string,
        PropTypes.instanceOf(Date),
      ]),
    })
  ),
  handlePostMessage: PropTypes.func.isRequired,
};

export default Chatcomponent;
