import { useEffect, useState } from "react";
import Chatcomponent from "../../components/Chatcomponent";

import "../styles/disax.css";
import { getUser } from "../../utils/factory";
import axios from "axios";
import WaverxLeftBar from "./LeftSideBar";
import { FiMenu } from "react-icons/fi";
import { WaverXBotPageSEO } from "../../components/SEOComponents";
import { chatbotApiUrl } from "../../config/env";

const chatbot = chatbotApiUrl("/api/v1");

function sortMessages(rows = []) {
  return [...rows].sort((a, b) => (a.postedAt || 0) - (b.postedAt || 0));
}

const WaverXChatPage = () => {
  const [chats, setChats] = useState([]);
  const [current, setCurrent] = useState("");
  const [messages, setMessages] = useState();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    fetchChats()
      .then((res) => {
        if (res.data) {
          const next = [...res.data].sort((a, b) => b.createdAt - a.createdAt);
          setChats(next);
        }
      })
      .catch((err) => console.log({ err }));
  }, []);

  useEffect(() => {
    if (!current) {
      setMessages(undefined);
      return undefined;
    }
    let cancelled = false;
    const loadMessages = async () => {
      try {
        const res = await axios.get(`${chatbot}/chats/${current}`);
        if (!cancelled && Array.isArray(res.data)) {
          setMessages(sortMessages(res.data));
        }
      } catch (err) {
        console.log({ err });
      }
    };
    loadMessages();
    const timer = setInterval(loadMessages, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [current]);

  async function fetchChats() {
    const url = `${chatbot}/chats?userId=${getUser()?.id}`;
    return axios.get(url);
  }

  function handleChatCardClicked(id) {
    setCurrent(id);
    setIsOpen(false);
  }

  async function handleCreateChat() {
    const userId = String(getUser()?.id);
    const res = await axios.post(`${chatbot}/chats`, { userId });
    if (res.data) {
      setChats((prev) => [res.data, ...prev]);
      setCurrent(res.data.id);
    }
    return res.data;
  }

  async function handlePostMessage(body, newCurrent) {
    if (!body) return;
    try {
      const chatId = newCurrent || current;
      if (newCurrent) setCurrent(newCurrent);
      const url = `${chatbot}/chats/${chatId}`;
      const res = await axios.post(url, { body, userId: String(getUser()?.id) });
      const incoming = [];
      if (res.data?.message) incoming.push(res.data.message);
      if (res.data?.response) incoming.push(res.data.response);
      if (incoming.length) {
        setMessages((prev) => sortMessages([...(prev || []), ...incoming]));
      }
    } catch (err) {
      console.log({ err });
    }
  }

  return (
    <>
      <WaverXBotPageSEO />
      <div className=" md:w-[100vw] md:flex h-[100vh] max-sm:max-h-screen overflow-hidden text-black">
      <div className="hidden md:grid md:w-[25vw] border-r-2 border-gray-200 ">
        <WaverxLeftBar
          handleCreateChat={handleCreateChat}
          chats={chats}
          current={current}
          handleChatCardClicked={handleChatCardClicked}
          setIsOpen={setIsOpen}
        />
      </div>
      <div className="md:hidden m-2 ">
        <FiMenu
          size={35}
          onClick={() => setIsOpen(true)}
          className="  cursor-pointer"
        />
        {isOpen === true ? (
          <WaverxLeftBar
            handleCreateChat={handleCreateChat}
            chats={chats}
            current={current}
            handleChatCardClicked={handleChatCardClicked}
            setIsOpen={setIsOpen}
          />
        ) : null}
      </div>
      <div className="md:grid flex justify-center">
        <div className=" w-[75vw] md:h-full h-[96vh] md:p-0 p-4 max-sm:w-[100vw] overflow-y-auto ">
          <Chatcomponent
            current={current}
            messages={messages}
            handlePostMessage={handlePostMessage}
            handleCreateChat={handleCreateChat}
          />
        </div>
      </div>
      </div>
    </>
  );
};

export default WaverXChatPage;
