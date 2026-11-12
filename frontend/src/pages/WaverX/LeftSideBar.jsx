import { GoSidebarExpand } from "react-icons/go";
import { useEffect, useState } from "react";
import Mobilemenu from "../../components/Mobilemenu";
import ChatsListCard from "../../components/ChatsListCard";

export default function WaverxLeftBar({
  setIsOpen,
  handleCreateChat,
  chats,
  current,
  handleChatCardClicked,
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [chatLists, setChatLists] = useState(chats)
  const [newCurrent, setNewCurrent] = useState(current)
  
  useEffect(()=> {
    const uniqueChats = Array.from(new Set(chats.map(chat => chat.id)))
      .map(id => chats.find(chat => chat.id === id));
    setChatLists(uniqueChats);
    setNewCurrent(current)
  }, [chats, current])

  return (
    <div
      onClick={() => setIsOpen(false)}
      className=" max-sm:absolute max-sm:top-0 max-sm:left-0  max-sm:w-[100vw] max-sm:z-10  max-sm:h-[100vh]"
    >
      <div
        className="max-sm:bg-white max-sm:w-[70vw] border-r-2 h-[100%]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-white px-4 py-4 shadow-xs  border-b-2 border-gray-300">
          <div>
            <GoSidebarExpand
              size={32}
              color={"#2F4F4F"}
              role="button"
              onClick={() => setIsMenuOpen(true)}
            />
            {isMenuOpen === true ? (
              <Mobilemenu setIsOpen={() => setIsMenuOpen(false)} />
            ) : null}
          </div>
          <div className="flex flex-2 items-center gap-3.5">
            <img
              src="/waverbot.png"
              alt="WaverX"
              className="h-10 w-10 object-contain"
              style={{ borderRadius: "50%" }}
            />
            <h1 className="!font-semibold md:text-[26px] text-[#2F4F4F] sm:text-[24px]">
              WaverX
            </h1>
          </div>
          <div
            className="flex self-end"
            onClick={handleCreateChat}
            role="button"
          >
            <img
              src="../../../img_plus_blue_gray_400.svg"
              alt="Plus"
              className="h-[32px] w-[32px] "
            />
          </div>
        </div>
        <div className="chats-list h-[90vh] overflow-y-auto ">
          {chatLists.map((c) => {
            return (
              <ChatsListCard
                isCurrent={c.id == newCurrent}
                title={c.title}
                handleClick={handleChatCardClicked}
                id={c.id}
                // createdAt={c.createdAt}
                key={c.remoteId}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
