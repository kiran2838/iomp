import React, { useState, useRef, useEffect } from "react";
import ACTIONS from "../Actions";
import Client from "../components/Client";
import Editor from "../components/Editor";
import { initSocket } from "../socket";
import {
  Navigate,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { toast } from "react-hot-toast";
import axios from "axios";

const EditorPage = () => {
  const socketRef = useRef(null);
  const codeRef = useRef(null);
  const location = useLocation();
  const reactNavigator = useNavigate();
  const { roomId } = useParams();
  const [clients, setClients] = useState([]);
  const [output, setOutput] = useState("");

  useEffect(() => {
    const init = async () => {
      socketRef.current = await initSocket();

      socketRef.current.on("connect_error", (err) => handleErrors(err));
      socketRef.current.on("connect_failed", (err) => handleErrors(err));

      function handleErrors(e) {
        console.log("Socket error", e);
        toast.error("Socket connection failed, try again later.");
        reactNavigator("/");
      }

      socketRef.current.emit(ACTIONS.JOIN, {
        roomId,
        username: location.state?.username,
      });

      // Listening for joined event
      socketRef.current.on(ACTIONS.JOINED, ({ clients, username, socketId }) => {
        if (username !== location.state?.username) {
          toast.success(`${username} joined the room.`);
          console.log(`${username} joined`);
        }
        setClients(clients);
        socketRef.current.emit(ACTIONS.SYNC_CODE, {
          code: codeRef.current,
          socketId,
        });
      });

      // Listening for disconnected users
      socketRef.current.on(ACTIONS.DISCONNECTED, ({ socketId, username }) => {
        toast.success(`${username} left the room.`);
        setClients((prev) => prev.filter((client) => client.socketId !== socketId));
      });

      // Listening for chat messages
      socketRef.current.on(ACTIONS.SEND_MESSAGE, ({ message }) => {
        const chatWindow = document.getElementById("chatWindow");
        chatWindow.value += message;
        chatWindow.scrollTop = chatWindow.scrollHeight;
      });
    };
    init();

    return () => {
      socketRef.current.off(ACTIONS.JOINED);
      socketRef.current.off(ACTIONS.DISCONNECTED);
      socketRef.current.off(ACTIONS.SEND_MESSAGE);
      socketRef.current.disconnect();
    };
  }, []);

  // Copy Room ID
  async function copyRoomId() {
    try {
      await navigator.clipboard.writeText(roomId);
      toast.success("Room ID has been copied to your clipboard");
    } catch (err) {
      toast.error("Could not copy the room ID");
      console.error(err);
    }
  }

  // Leave Room
  function leaveRoom() {
    reactNavigator("/");
  }

  // Ensure the user is properly authenticated
  if (!location.state) {
    return <Navigate to="/" />;
  }

  // Handle input/output tab switching
  const inputClicked = () => {
    document.getElementById("input").placeholder = "Enter your input here";
    document.getElementById("input").value = "";
    document.getElementById("input").disabled = false;
  };

  const outputClicked = () => {
    document.getElementById("input").placeholder = "Output will appear here after execution";
    document.getElementById("input").value = output;
    document.getElementById("input").disabled = true;
  };

  // Handle Code Execution (JDoodle API)
  const handleOutput = async (e) => {
    e.preventDefault();
    try {
      const lang = document.getElementById("languageOptions").value;
      const code = codeRef.current;
      const input = document.getElementById("input").value;

      toast.loading("Executing code...");

      const res = await axios.post(`https://syntexity.onrender.com/execute`, {
        clientId: "1a84ac9ae69763aa3e7896e1389c4b5b",
        clientSecret: "ac9b8b22a649f702e95d066f35fb2eb3b07613d5f949fde39193d34fbf79b89b",
        language: lang,
        script: code,
        stdin: input,
      });

      setOutput(res.data.output || res.data.error);
      outputClicked();
      toast.dismiss();
      toast.success("Execution complete");
    } catch (error) {
      console.error(error);
      toast.dismiss();
      toast.error("Execution failed. Check your code.");
    }
  };

  // Send Chat Message
  const sendMessage = () => {
    const messageInput = document.getElementById("inputBox");
    if (messageInput.value.trim() === "") return;

    const message = `> ${location.state.username}:\n${messageInput.value}\n`;
    const chatWindow = document.getElementById("chatWindow");
    chatWindow.value += message;
    chatWindow.scrollTop = chatWindow.scrollHeight;
    messageInput.value = "";

    socketRef.current.emit(ACTIONS.SEND_MESSAGE, { roomId, message });
  };

  // Send message on pressing Enter
  const handleInputEnter = (key) => {
    if (key.code === "Enter") {
      sendMessage();
    }
  };

  return (
    <div className="mainWrap">
      <div className="asideWrap">
        <div className="asideInner">
          <div className="logo">
            <img className="logoImage" src="/code-sync.png" alt="logo" />
          </div>
          <h3>Connected</h3>
          <div className="clientsList">
            {clients.map((client) => (
              <Client key={client.socketId} username={client.username} />
            ))}
          </div>
        </div>
        <label>
          Select Language:
          <select id="languageOptions" className="seLang" defaultValue="17">
            <option value="python3">Python</option>
            <option value="cpp17">C++</option>
            <option value="c">C</option>
          </select>
        </label>
        <button className="btn runBtn" onClick={handleOutput}>
          Run Code
        </button>
        <button className="btn copyBtn" onClick={copyRoomId}>
          Copy ROOM ID
        </button>
        <button className="btn leaveBtn" onClick={leaveRoom}>
          Leave
        </button>
      </div>

      <div className="editorWrap">
        <Editor
          socketRef={socketRef}
          roomId={roomId}
          onCodeChange={(code) => {
            codeRef.current = code;
          }}
        />
        <div className="IO-container">
          <label className="clickedLabel" onClick={inputClicked}>Input</label>
          <label className="notClickedLabel" onClick={outputClicked}>Output</label>
        </div>
        <textarea id="input" className="inputArea textarea-style" placeholder="Enter your input here"></textarea>
      </div>

      <div className="chatWrap">
        <textarea id="chatWindow" className="chatArea textarea-style" placeholder="Chat messages will appear here" disabled></textarea>
        <div className="sendChatWrap">
          <input id="inputBox" type="text" placeholder="Type your message here" className="inputField" onKeyUp={handleInputEnter} />
          <button className="btn sendBtn" onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
};

export default EditorPage;
