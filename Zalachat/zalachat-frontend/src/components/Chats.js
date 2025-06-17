import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Chats() {
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [filePreviewType, setFilePreviewType] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [userNames, setUserNames] = useState({});
  const [callState, setCallState] = useState(null); // null, incoming, outgoing, active
  const [callType, setCallType] = useState(null); // voice, video
  const [peerConnection, setPeerConnection] = useState(null);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [nickname, setNickname] = useState("");
  const [profile, setProfile] = useState(null);
  const [showSharedMedia, setShowSharedMedia] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [callStartTime, setCallStartTime] = useState(null);
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const ringtoneRef = useRef(null);
  const [callDuration, setCallDuration] = useState(0);

  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
    ],
  };

  const themes = [
    { name: "Mặc định", color: "#0078FF", icon: "🟦" },
    { name: "Xanh lá", color: "#28a745", icon: "🟩" },
    { name: "Hồng", color: "#ff69b4", icon: "🟥" },
    { name: "Tím", color: "#800080", icon: "🟪" },
  ];

  const initializePeerConnection = () => {
    const pc = new RTCPeerConnection(configuration);
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit("iceCandidate", {
          conversationId: selectedConversation.conversationId,
          candidate: event.candidate,
          to: selectedConversation.friendId,
        });
      }
    };
    pc.onicecandidateerror = (error) => {
      console.error("ICE candidate error:", error);
      toast.error("Lỗi kết nối WebRTC");
    };
    pc.ontrack = (event) => {
      if (event.streams[0]) {
        remoteStreamRef.current = event.streams[0];
        if (remoteVideoRef.current && callType === "video") {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        const audioTracks = remoteStreamRef.current.getAudioTracks();
        if (audioTracks.length > 0) {
          console.log("Received remote audio track:", audioTracks);
          toast.info("Đã nhận được âm thanh từ phía bên kia");
        } else {
          console.warn("No audio track received in remote stream");
          toast.warn("Không nhận được âm thanh từ phía bên kia");
        }
      }
    };
    pc.onconnectionstatechange = () => {
      console.log("Connection state:", pc.connectionState);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handleEndCall();
        toast.error("Kết nối cuộc gọi bị gián đoạn");
      } else if (pc.connectionState === "connected") {
        toast.success("Kết nối cuộc gọi thành công");
      }
    };
    setPeerConnection(pc);
    return pc;
  };

  const checkAudioStream = (stream) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      console.warn("No audio track found in local stream");
      toast.error("Không phát hiện âm thanh. Vui lòng kiểm tra microphone.");
      return false;
    }
    console.log("Audio track found:", audioTracks);
    toast.info("Microphone hoạt động bình thường");
    return true;
  };

  const getUserMedia = async (isVideo) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: isVideo ? { facingMode: "user" } : false,
      });
      if (!checkAudioStream(stream)) {
        throw new Error("No audio track available");
      }
      if (isVideo && localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      localStreamRef.current = stream;
      return stream;
    } catch (error) {
      console.error("Error accessing media devices:", error);
      if (error.name === "NotAllowedError") {
        toast.error("Vui lòng cấp quyền truy cập camera hoặc microphone");
      } else if (error.name === "NotFoundError") {
        toast.error("Không tìm thấy thiết bị camera hoặc microphone");
      } else {
        toast.error("Không thể truy cập thiết bị media: " + error.message);
      }
      return null;
    }
  };

  const playRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.src = "/ringtone.mp3";
      ringtoneRef.current.loop = true;
      ringtoneRef.current
        .play()
        .catch((error) => {
          console.error("Error playing ringtone:", error);
          toast.error("Không thể phát nhạc chuông: " + error.message);
        });
    }
  };

  const stopRingtone = () => {
    if (ringtoneRef.current) {
      ringtoneRef.current.pause();
      ringtoneRef.current.currentTime = 0;
    }
  };
useEffect(() => {
  let timer;
  if (callState === "active" && callStartTime) {
    timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }
  return () => {
    if (timer) clearInterval(timer);
    if (callState !== "active") setCallDuration(0);
  };
}, [callState, callStartTime]);
  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.accessToken) {
      window.location.href = "/login";
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/auth/user`,
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        );
        setCurrentUser(response.data.username);
      } catch (error) {
        console.error("Error fetching user info:", error);
        toast.error("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại!");
        localStorage.removeItem("tokens");
        window.location.href = "/login";
      }
    };

    fetchUserInfo();
  }, []);

  const fetchFriends = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/contacts/friends`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      const friendMap = {};
      response.data.forEach((friend) => {
        friendMap[friend.friendId] = friend.friendName;
      });
      setUserNames((prev) => ({ ...prev, ...friendMap }));
    } catch (error) {
      console.error("Error fetching friends:", error);
    }
  };
const formatDuration = (seconds) => {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};
  const getFriendName = async (userId) => {
    if (userNames[userId]) return userNames[userId];

    const conv = conversations.find((c) => c.friendId === userId);
    if (conv) {
      setUserNames((prev) => ({ ...prev, [userId]: conv.friendName }));
      return conv.friendName;
    }

    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/user/${userId}`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      const name = response.data.name || response.data.username || userId;
      setUserNames((prev) => ({ ...prev, [userId]: name }));
      return name;
    } catch (error) {
      console.error(`Error fetching user name ${userId}:`, error);
      return userId;
    }
  };

  const fetchUserProfile = async (userId) => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/auth/user/${userId}`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      setProfile(response.data);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      toast.error("Không thể tải thông tin cá nhân");
    }
  };

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.accessToken || !currentUser) return;

    socketRef.current = io("http://localhost:5000", {
      auth: { token: tokens.accessToken },
      transports: ["websocket"],
    });

    socketRef.current.on("connect", () => {
      console.log("Socket.IO connected with ID:", socketRef.current.id);
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error.message);
      toast.error("Không thể kết nối đến server: " + error.message);
    });

socketRef.current.on("receiveMessage", async (message) => {
  if (message.senderId === currentUser) return;
  if (
    messages.some(
      (msg) =>
        msg.timestamp === message.timestamp &&
        msg.senderId === message.senderId &&
        msg.content === message.content
    )
  )
    return;

  if (message.receiverId === currentUser || message.senderId === currentUser) {
    let forwardedName = null;
    if (message.forwardedFrom) {
      forwardedName = await getFriendName(message.forwardedFrom);
      message.forwardedName = forwardedName;
    }

    if (
      selectedConversation &&
      message.conversationId === selectedConversation.conversationId
    ) {
      setMessages((prevMessages) => [...prevMessages, message]);
      setLastMessages((prev) => {
        const newLastMessages = {
          ...prev,
          [message.conversationId]: message,
        };
        // Sort conversations immediately after updating lastMessages
        setConversations((prevConvs) =>
          [...prevConvs]
            .sort((a, b) => {
              const timestampA = newLastMessages[a.conversationId]?.timestamp
                ? new Date(newLastMessages[a.conversationId].timestamp).getTime()
                : 0;
              const timestampB = newLastMessages[b.conversationId]?.timestamp
                ? new Date(newLastMessages[b.conversationId].timestamp).getTime()
                : 0;
              return timestampB - timestampA;
            })
            .map((conv) =>
              conv.conversationId === message.conversationId
                ? { ...conv, lastMessage: message }
                : conv
            )
        );
        return newLastMessages;
      });
    } else {
      let senderName = message.senderId;
      const senderConv = conversations.find(
        (conv) => conv.friendId === message.senderId
      );

      if (senderConv) {
        senderName = senderConv.friendName;
      } else {
        fetchConversations();
        senderName = await getFriendName(message.senderId);
      }

      setLastMessages((prev) => {
        const newLastMessages = {
          ...prev,
          [message.conversationId]: message,
        };
        // Sort conversations immediately after updating lastMessages
        setConversations((prevConvs) =>
          [...prevConvs]
            .sort((a, b) => {
              const timestampA = newLastMessages[a.conversationId]?.timestamp
                ? new Date(newLastMessages[a.conversationId].timestamp).getTime()
                : 0;
              const timestampB = newLastMessages[b.conversationId]?.timestamp
                ? new Date(newLastMessages[b.conversationId].timestamp).getTime()
                : 0;
              return timestampB - timestampA;
            })
            .map((conv) =>
              conv.conversationId === message.conversationId
                ? { ...conv, lastMessage: message }
                : conv
            )
        );
        return newLastMessages;
      });
      setUnreadMessages((prev) => ({
        ...prev,
        [message.conversationId]: true,
      }));

      toast.info(`Tin nhắn mới từ ${senderName}`, {
        position: "top-right",
        autoClose: 3000,
        onClick: () => {
          const conversation = conversations.find(
            (conv) => conv.conversationId === message.conversationId
          );
          if (conversation) {
            setSelectedConversation(conversation);
            setUnreadMessages((prev) => ({
              ...prev,
              [message.conversationId]: false,
            }));
          } else {
            fetchConversations().then(() => {
              const updatedConv = conversations.find(
                (conv) => conv.conversationId === message.conversationId
              );
              if (updatedConv) {
                setSelectedConversation(updatedConv);
                setUnreadMessages((prev) => ({
                  ...prev,
                  [message.conversationId]: false,
                }));
              }
            });
          }
        },
      });
    }
  }
});

socketRef.current.on("messageRecalled", ({ conversationId, timestamp }) => {
  if (selectedConversation?.conversationId === conversationId) {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.timestamp === timestamp
          ? { ...msg, type: "recalled", status: "recalled" }
          : msg
      )
    );
    toast.success("Tin nhắn đã được thu hồi thành công!");
  }
  setLastMessages((prev) => {
    if (prev[conversationId]?.timestamp === timestamp) {
      return {
        ...prev,
        [conversationId]: {
          ...prev[conversationId],
          type: "recalled",
          status: "recalled",
        },
      };
    }
    return prev;
  });
  // Re-sort conversations
  setConversations((prev) =>
    [...prev].sort((a, b) => {
      const timestampA = lastMessages[a.conversationId]?.timestamp
        ? new Date(lastMessages[a.conversationId].timestamp).getTime()
        : 0;
      const timestampB = lastMessages[b.conversationId]?.timestamp
        ? new Date(lastMessages[b.conversationId].timestamp).getTime()
        : 0;
      return timestampB - timestampA;
    })
  );
});

    socketRef.current.on("messageDeleted", ({ conversationId, timestamp, userId }) => {
      if (selectedConversation?.conversationId === conversationId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.timestamp === timestamp && userId === currentUser
              ? { ...msg, status: "deleted" }
              : msg
          )
        );
        if (userId === currentUser) {
          toast.success("Tin nhắn đã được xóa thành công!");
        }
      }
      setLastMessages((prev) => {
        if (
          prev[conversationId]?.timestamp === timestamp &&
          userId === currentUser
        ) {
          return {
            ...prev,
            [conversationId]: {
              ...prev[conversationId],
              status: "deleted",
            },
          };
        }
        return prev;
      });
    });

    socketRef.current.on("friendRequestAccepted", () => {
      fetchConversations();
    });

    socketRef.current.on("conversationUpdated", () => {
      fetchConversations();
    });

    socketRef.current.on("callRequest", async ({ from, conversationId, callType: incomingCallType }) => {
      console.log("Received callRequest:", { from, conversationId, callType: incomingCallType });
      if (callState) {
        socketRef.current.emit("callResponse", {
          to: from,
          conversationId,
          accepted: false,
        });
        return;
      }
      const fromName = await getFriendName(from);
      setCallState("incoming");
      setCallType(incomingCallType);
      const conversation = conversations.find(
        (conv) => conv.conversationId === conversationId
      );
      if (conversation) {
        setSelectedConversation(conversation);
      } else {
        await fetchConversations();
        const updatedConv = conversations.find(
          (conv) => conv.conversationId === conversationId
        );
        if (updatedConv) {
          setSelectedConversation(updatedConv);
        }
      }
      playRingtone();
      addSystemMessage(`${fromName} đã bắt đầu một cuộc gọi ${incomingCallType === "video" ? "video" : "thoại"}`);
      toast.info(
        `${fromName} đang gọi ${incomingCallType === "video" ? "video" : "thoại"} cho bạn`,
        {
          position: "top-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          toastId: "incoming-call",
        }
      );
    });

    socketRef.current.on("callResponse", async ({ from, accepted }) => {
      console.log("Received callResponse:", { from, accepted });
      stopRingtone();
      if (!accepted) {
        toast.dismiss("outgoing-call");
        toast.info("Cuộc gọi bị từ chối", {
          position: "top-center",
          autoClose: 3000,
        });
        addSystemMessage("Cuộc gọi bị từ chối");
        cleanupCall(peerConnection);
        return;
      }
      const pc = initializePeerConnection();
      const stream = await getUserMedia(callType === "video");
      if (stream) {
        stream.getTracks().forEach((track) => {
          pc.addTrack(track, stream);
          console.log("Added track to peer connection:", track);
        });
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socketRef.current.emit("offer", {
            conversationId: selectedConversation.conversationId,
            offer,
            to: selectedConversation.friendId,
          });
          setCallState("active");
          setCallStartTime(new Date());
          toast.dismiss("outgoing-call");
        } catch (error) {
          console.error("Error creating offer:", error);
          cleanupCall(pc);
          toast.error("Lỗi thiết lập cuộc gọi");
        }
      } else {
        socketRef.current.emit("callEnd", {
          conversationId: selectedConversation.conversationId,
          to: selectedConversation.friendId,
        });
        cleanupCall(pc);
      }
    });

    socketRef.current.on("offer", async ({ from, offer }) => {
      console.log("Received offer:", { from, offer, conversationId: selectedConversation?.conversationId });
      if (!selectedConversation) {
        console.error("No selected conversation for offer");
        toast.error("Không thể xử lý cuộc gọi: Không có cuộc trò chuyện");
        socketRef.current.emit("callEnd", {
          conversationId: selectedConversation?.conversationId,
          to: from,
        });
        return;
      }
      const pc = initializePeerConnection();
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log("Set remote description successfully");
        const stream = await getUserMedia(callType === "video");
        if (stream) {
          stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
            console.log("Added track to peer connection:", track);
          });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          console.log("Created and set answer");
          socketRef.current.emit("answer", {
            conversationId: selectedConversation.conversationId,
            answer,
            to: from,
          });
          setCallState("active");
          setCallStartTime(new Date());
          console.log("Call state set to active, timer started");
          toast.dismiss("incoming-call");
          toast.info("Cuộc gọi đã bắt đầu", { position: "top-center", autoClose: 3000 });
        } else {
          throw new Error("No media stream");
        }
      } catch (error) {
        console.error("Error handling offer:", error);
        socketRef.current.emit("callEnd", {
          conversationId: selectedConversation.conversationId,
          to: from,
        });
        cleanupCall(pc);
        toast.error("Lỗi thiết lập cuộc gọi: " + error.message);
      }
    });

    socketRef.current.on("answer", async ({ answer }) => {
      console.log("Received answer:", answer);
      if (peerConnection) {
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(answer)
          );
        } catch (error) {
          console.error("Error setting remote description:", error);
          toast.error("Lỗi thiết lập cuộc gọi");
        }
      }
    });

    socketRef.current.on("iceCandidate", async ({ candidate }) => {
      console.log("Received iceCandidate:", candidate);
      if (peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
          console.error("Error adding ICE candidate:", error);
        }
      }
    });

    socketRef.current.on("callEnd", () => {
      console.log("Received callEnd, cleaning up");
      addCallEndMessage("Cuộc gọi đã kết thúc");
      cleanupCall(peerConnection);
      toast.dismiss();
      toast.info("Cuộc gọi đã kết thúc", {
        position: "top-center",
        autoClose: 3000,
      });
    });

    socketRef.current.on("nicknameChanged", async ({ from, newNickname, conversationId }) => {
      if (selectedConversation?.conversationId === conversationId) {
        const friendName = await getFriendName(from);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.conversationId === conversationId
              ? { ...conv, friendName: newNickname }
              : conv
          )
        );
        setSelectedConversation((prev) => ({
          ...prev,
          friendName: newNickname,
        }));
        setUserNames((prev) => ({
          ...prev,
          [from]: newNickname,
        }));
        addSystemMessage(`${friendName} đã đổi biệt hiệu thành ${newNickname}`);
      }
    });

    socketRef.current.on("themeChanged", async ({ from, newTheme, conversationId }) => {
      if (selectedConversation?.conversationId === conversationId) {
        const friendName = await getFriendName(from);
        setConversations((prev) =>
          prev.map((conv) =>
            conv.conversationId === conversationId ? { ...conv, theme: newTheme } : conv
          )
        );
        setSelectedConversation((prev) => ({
          ...prev,
          theme: newTheme,
        }));
        addSystemMessage(`${friendName} đã đổi màu sắc thành ${getThemeName(newTheme)}`);
        toast.success("Chủ đề đã được cập nhật!");
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanupCall(peerConnection);
    };
  }, [currentUser, selectedConversation, conversations]);

  useEffect(() => {
    if (currentUser) {
      fetchFriends();
    }
  }, [currentUser]);

  useEffect(() => {
    if (selectedConversation) {
      localStorage.setItem(
        "selectedConversationId",
        selectedConversation.conversationId
      );
    }
  }, [selectedConversation]);

  useEffect(() => {
    const savedConversationId = localStorage.getItem("selectedConversationId");
    if (savedConversationId && conversations.length > 0) {
      const savedConversation = conversations.find(
        (conv) => conv.conversationId === savedConversationId
      );
      if (savedConversation) {
        setSelectedConversation(savedConversation);
      }
    }
  }, [conversations]);

const fetchConversations = async () => {
  const tokens = JSON.parse(localStorage.getItem("tokens"));
  if (!tokens?.accessToken) return Promise.reject("No access token");

  try {
    const convResponse = await axios.get(
      `${process.env.REACT_APP_API_URL}/chats/conversations`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      }
    );
    const updatedConversations = convResponse.data.map((conv) => ({
      ...conv,
      theme: localStorage.getItem(`theme_${conv.conversationId}`) || conv.theme,
      friendName:
        localStorage.getItem(`nickname_${conv.conversationId}`) ||
        conv.friendName,
    }));

    try {
      const lastMsgResponse = await axios.get(
        `${process.env.REACT_APP_API_URL}/chats/last-messages`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      const lastMessagesData = lastMsgResponse.data;
      await Promise.all(
        Object.keys(lastMessagesData).map(async (conversationId) => {
          const msg = lastMessagesData[conversationId];
          if (msg.forwardedFrom && !msg.forwardedName) {
            msg.forwardedName = await getFriendName(msg.forwardedFrom);
          }
        })
      );
      setLastMessages(lastMessagesData);

      // Sort conversations based on the timestamp of last messages
      updatedConversations.sort((a, b) => {
        const timestampA = lastMessagesData[a.conversationId]?.timestamp
          ? new Date(lastMessagesData[a.conversationId].timestamp).getTime()
          : 0;
        const timestampB = lastMessagesData[b.conversationId]?.timestamp
          ? new Date(lastMessagesData[b.conversationId].timestamp).getTime()
          : 0;
        return timestampB - timestampA;
      });

      setConversations(updatedConversations);

      const friendMap = {};
      updatedConversations.forEach((conv) => {
        friendMap[conv.friendId] = conv.friendName;
      });
      setUserNames((prev) => ({ ...prev, ...friendMap }));

      return updatedConversations;
    } catch (error) {
      console.error("Error fetching last messages:", error);
      updatedConversations.sort((a, b) => b.conversationId.localeCompare(a.conversationId));
      setConversations(updatedConversations);
      return updatedConversations;
    }
  } catch (error) {
    console.error("Error fetching conversations:", error);
    return Promise.reject(error);
  }
};

  useEffect(() => {
    if (currentUser) {
      fetchConversations().then((convs) => {
        const savedConversationId = localStorage.getItem("selectedConversationId");
        if (savedConversationId && convs) {
          const savedConversation = convs.find(
            (conv) => conv.conversationId === savedConversationId
          );
          if (savedConversation) {
            setSelectedConversation(savedConversation);
          } else if (convs.length > 0) {
            setSelectedConversation(convs[0]);
          }
        } else if (convs && convs.length > 0) {
          setSelectedConversation(convs[0]);
        }
      });
    }
  }, [currentUser]);

  useEffect(() => {
    if (!socketRef.current || !conversations.length) return;

    conversations.forEach((conv) => {
      if (conv.conversationId) {
        socketRef.current.emit("joinConversation", {
          conversationId: conv.conversationId,
        });
      }
    });
  }, [conversations]);

  const fetchMessages = async () => {
    if (!selectedConversation) return;
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/chats/messages/${selectedConversation.conversationId}`,
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );
      const updatedMessages = await Promise.all(
        response.data.map((msg) =>
          msg.forwardedFrom && !msg.forwardedName
            ? getFriendName(msg.forwardedFrom).then((forwardedName) => ({
                ...msg,
                forwardedName,
              }))
            : Promise.resolve(msg)
        )
      );
      setMessages(updatedMessages);
      setUnreadMessages((prev) => ({
        ...prev,
        [selectedConversation.conversationId]: false,
      }));
    } catch (error) {
      console.error("Error fetching messages:", error);
    }
  };

  useEffect(() => {
    if (selectedConversation && socketRef.current) {
      socketRef.current.emit("joinConversation", {
        conversationId: selectedConversation.conversationId,
      });
      fetchMessages();
      fetchUserProfile(selectedConversation.friendId);
      setShowSearchBar(false);
      setSearchQuery("");
    }
  }, [selectedConversation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleStartCall = async (type) => {
    if (!selectedConversation) {
      toast.error("Vui lòng chọn một cuộc trò chuyện");
      return;
    }
    if (callState || peerConnection) {
      toast.error("Đang có cuộc gọi khác");
      return;
    }
    setCallType(type);
    setCallState("outgoing");
    playRingtone();
    const pc = initializePeerConnection();
    const stream = await getUserMedia(type === "video");
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log("Added track to peer connection:", track);
      });
      socketRef.current.emit("callRequest", {
        conversationId: selectedConversation.conversationId,
        to: selectedConversation.friendId,
        callType: type,
      });
      addSystemMessage(`Bạn đã bắt đầu một cuộc gọi ${type === "video" ? "video" : "thoại"}`);
      toast.info(
        `Đang gọi ${type === "video" ? "video" : "thoại"} tới ${selectedConversation.friendName}`,
        {
          position: "top-center",
          autoClose: false,
          closeOnClick: false,
          draggable: false,
          toastId: "outgoing-call",
        }
      );
    } else {
      cleanupCall(pc);
      toast.error("Không thể truy cập thiết bị media");
    }
  };

  const handleAcceptCall = async () => {
    console.log("handleAcceptCall called", {
      callState,
      callType,
      conversationId: selectedConversation?.conversationId,
      friendId: selectedConversation?.friendId,
    });
    if (!socketRef.current || !socketRef.current.connected) {
      console.error("Socket not connected");
      toast.error("Không thể kết nối đến server, vui lòng thử lại");
      return;
    }
    if (!selectedConversation) {
      console.error("No selected conversation");
      toast.error("Vui lòng chọn một cuộc trò chuyện");
      return;
    }
    stopRingtone();
    socketRef.current.emit("callResponse", {
      to: selectedConversation.friendId,
      conversationId: selectedConversation.conversationId,
      accepted: true,
    });
    addSystemMessage(`Bạn đã chấp nhận cuộc gọi ${callType === "video" ? "video" : "thoại"}`);
    toast.dismiss("incoming-call");

    // Initialize peer connection and prepare for offer
    const pc = initializePeerConnection();
    const stream = await getUserMedia(callType === "video");
    if (stream) {
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        console.log("Added track to peer connection:", track);
      });
      setCallState("active"); // Update call state to active
      setCallStartTime(new Date()); // Start call timer
      toast.info(`Đang gọi ${callType === "video" ? "video" : "thoại"} với ${selectedConversation.friendName}`, {
        position: "top-center",
        autoClose: 3000,
      });
    } else {
      socketRef.current.emit("callEnd", {
        conversationId: selectedConversation.conversationId,
        to: selectedConversation.friendId,
      });
      cleanupCall(pc);
      toast.error("Không thể truy cập thiết bị media");
    }
  };

  const cleanupCall = (pc) => {
    setCallDuration(0);
    stopRingtone();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }
    if (remoteStreamRef.current) {
      remoteStreamRef.current.getTracks().forEach((track) => track.stop());
      remoteStreamRef.current = null;
    }
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    if (pc) {
      pc.close();
    }
    setPeerConnection(null);
    setCallState(null);
    setCallType(null);
    setCallStartTime(null);
  };

  const handleRejectCall = () => {
    socketRef.current.emit("callResponse", {
      to: selectedConversation.friendId,
      conversationId: selectedConversation.conversationId,
      accepted: false,
    });
    addSystemMessage("Cuộc gọi bị từ chối");
    cleanupCall(null);
    toast.dismiss("incoming-call");
  };

  const handleEndCall = () => {
    socketRef.current.emit("callEnd", {
      conversationId: selectedConversation.conversationId,
      to: selectedConversation.friendId,
    });
    addCallEndMessage("Cuộc gọi đã kết thúc");
    cleanupCall(peerConnection);
    toast.dismiss();
  };

const handleSendMessage = async () => {
  if ((!newMessage.trim() && !file) || !selectedConversation) return;

  let messageContent = newMessage;
  let messageType = "text";

  if (file) {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/upload`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("tokens")).accessToken}`,
          },
        }
      );
      messageContent = response.data.fileUrl;
      messageType = getFileType(file.name);
    } catch (error) {
      console.error("Error uploading file:", error);
      toast.error("Không thể tải file lên");
      return;
    }
  }

  const message = {
    conversationId: selectedConversation.conversationId,
    senderId: currentUser,
    receiverId: selectedConversation.friendId,
    content: messageContent,
    type: messageType,
    timestamp: new Date().toISOString(),
  };

  if (socketRef.current) {
    socketRef.current.emit("sendMessage", message);
  }

  // Update messages and lastMessages in a single step
  setMessages((prev) => [...prev, { ...message, status: "sent" }]);
  setLastMessages((prev) => {
    const newLastMessages = {
      ...prev,
      [selectedConversation.conversationId]: { ...message, status: "sent" },
    };
    // Sort conversations immediately after updating lastMessages
    setConversations((prevConvs) =>
      [...prevConvs]
        .sort((a, b) => {
          const timestampA = newLastMessages[a.conversationId]?.timestamp
            ? new Date(newLastMessages[a.conversationId].timestamp).getTime()
            : 0;
          const timestampB = newLastMessages[b.conversationId]?.timestamp
            ? new Date(newLastMessages[b.conversationId].timestamp).getTime()
            : 0;
          return timestampB - timestampA;
        })
        .map((conv) =>
          conv.conversationId === selectedConversation.conversationId
            ? { ...conv, lastMessage: message }
            : conv
        )
    );
    return newLastMessages;
  });

  setNewMessage("");
  setFile(null);
  setFilePreview(null);
  setFilePreviewType(null);
};

  const handleEmojiClick = (emojiObject) => {
    setNewMessage((prev) => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.size > 50 * 1024 * 1024) {
        toast.error("File quá lớn, vui lòng chọn file dưới 50MB");
        return;
      }
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "audio/mpeg",
        "audio/wav",
        "audio/ogg",
        "video/mp4",
        "video/avi",
        "video/x-matroska",
        "video/webm",
        "video/quicktime",
      ];
      if (!allowedTypes.includes(selectedFile.type)) {
        toast.error(
          "Chỉ hỗ trợ file JPG, PNG, GIF, MP3, WAV, OGG, MP4, AVI, MKV, WEBM, MOV"
        );
        return;
      }
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreview(previewUrl);
      setFilePreviewType(getFileType(selectedFile.name));
    }
  };

  const handleRecallMessage = (timestamp) => {
    if (!window.confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) return;

    toast.info("Đang thu hồi tin nhắn...");
    socketRef.current.emit("recallMessage", {
      conversationId: selectedConversation.conversationId,
      timestamp,
    });
  };

  const handleDeleteMessage = (timestamp) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa tin nhắn này?")) return;

    setMessages((prev) =>
      prev.map((msg) =>
        msg.timestamp === timestamp && msg.senderId === currentUser
          ? { ...msg, status: "deleted" }
          : msg
      )
    );
    setLastMessages((prev) => {
      if (
        prev[selectedConversation.conversationId]?.timestamp === timestamp &&
        prev[selectedConversation.conversationId]?.senderId === currentUser
      ) {
        return {
          ...prev,
          [selectedConversation.conversationId]: {
            ...prev[selectedConversation.conversationId],
            status: "deleted",
          },
        };
      }
      return prev;
    });

    toast.success("Tin nhắn đã được xóa thành công!");

    socketRef.current.emit("deleteMessage", {
      conversationId: selectedConversation.conversationId,
      timestamp,
      userId: currentUser,
    });
  };

  const handleForwardMessage = (message) => {
    if (conversations.length <= 1) {
      toast.error("Không có cuộc trò chuyện nào khác để chuyển tiếp!");
      return;
    }
    setForwardMessage(message);
    setShowForwardModal(true);
  };

  const handleForwardToConversation = (targetConversation) => {
    socketRef.current.emit("forwardMessage", {
      conversationId: selectedConversation.conversationId,
      newConversationId: targetConversation.conversationId,
      content: forwardMessage.content,
      type: forwardMessage.type,
      forwardedFrom: forwardMessage.senderId,
    });
    toast.info(`Đã chuyển tiếp tin nhắn tới ${targetConversation.friendName}`);
    setShowForwardModal(false);
    setForwardMessage(null);
  };

  const handleChangeTheme = async (themeColor) => {
    if (!selectedConversation) return;

    try {
      localStorage.setItem(
        `theme_${selectedConversation.conversationId}`,
        themeColor
      );
      setConversations((prev) =>
        prev.map((conv) =>
          conv.conversationId === selectedConversation.conversationId
            ? { ...conv, theme: themeColor }
            : conv
        )
      );
      setSelectedConversation((prev) => ({
        ...prev,
        theme: themeColor,
      }));
      socketRef.current.emit("themeChanged", {
        from: currentUser,
        newTheme: themeColor,
        conversationId: selectedConversation.conversationId,
      });
      addSystemMessage(`Bạn đã đổi màu sắc thành ${getThemeName(themeColor)}`);
      toast.success("Đã thay đổi chủ đề!");
      setShowThemeModal(false);
      setShowSettingsModal(true);
    } catch (error) {
      console.error("Error changing theme:", error);
      toast.error("Không thể thay đổi chủ đề");
    }
  };

  const handleSetNickname = async () => {
    if (!nickname.trim() || !selectedConversation) return;

    try {
      localStorage.setItem(
        `nickname_${selectedConversation.conversationId}`,
        nickname
      );
      setConversations((prev) =>
        prev.map((conv) =>
          conv.conversationId === selectedConversation.conversationId
            ? { ...conv, friendName: nickname }
            : conv
        )
      );
      setSelectedConversation((prev) => ({
        ...prev,
        friendName: nickname,
      }));
      setUserNames((prev) => ({
        ...prev,
        [selectedConversation.friendId]: nickname,
      }));
      socketRef.current.emit("nicknameChanged", {
        from: currentUser,
        newNickname: nickname,
        conversationId: selectedConversation.conversationId,
      });
      addSystemMessage(`Bạn đã đặt biệt hiệu thành ${nickname}`);
      toast.success("Đã đặt biệt hiệu!");
      setShowNicknameModal(false);
      setNickname("");
      setShowSettingsModal(true);
    } catch (error) {
      console.error("Error setting nickname:", error);
      toast.error("Không thể đặt biệt hiệu");
    }
  };

  const handleShowSearchBar = () => {
    setShowSettingsModal(false);
    setShowSearchBar(true);
  };

  const handleShowSharedMedia = () => {
    setShowSettingsModal(false);
    setShowSharedMedia(true);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
  };

  const handleCancelSearch = () => {
    setShowSearchBar(false);
    setSearchQuery("");
  };

  const handleMediaClick = (msg) => {
    if (msg.type === "image" || msg.type === "video") {
      setSelectedMedia(msg);
      setShowMediaPreview(true);
    }
  };

  const filterMessageContent = (content) => {
    const uuidRegex =
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return content.replace(uuidRegex, "").trim();
  };

  const getFileType = (url) => {
    if (/\.(jpg|jpeg|png|gif)$/i.test(url)) return "image";
    if (/\.(mp3|wav|ogg)$/i.test(url)) return "audio";
    if (/\.(mp4|avi|mkv|webm|mov)$/i.test(url)) return "video";
    return "file";
  };

  const getMessagePreview = (msg) => {
    if (!msg) return "";
    if (msg.status === "deleted") return "Tin nhắn đã bị xóa";
    if (msg.type === "recalled") return "Tin nhắn đã được thu hồi";
    if (msg.type === "image") return "Hình ảnh";
    if (msg.type === "video") return "Video";
    if (msg.type === "audio") return "Âm thanh";
    if (msg.type === "file") return "Tệp";
    return filterMessageContent(msg.content).slice(0, 50);
  };

  const filteredMessages = messages.filter((msg) =>
    filterMessageContent(msg.content)
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const formatDate = (date) => {
    const daysOfWeek = [
      "Chủ nhật",
      "Thứ 2",
      "Thứ 3",
      "Thứ 4",
      "Thứ 5",
      "Thứ 6",
      "Thứ 7",
    ];
    const day = date.getDay();
    const dayOfMonth = date.getDate().toString().padStart(2, "0");
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const year = date.getFullYear();
    return `${daysOfWeek[day]}, ${dayOfMonth}/${month}/${year}`;
  };

  const isDifferentDay = (currentMsgDate, prevMsgDate) => {
    if (!prevMsgDate) return true;
    return (
      currentMsgDate.getDate() !== prevMsgDate.getDate() ||
      currentMsgDate.getMonth() !== prevMsgDate.getMonth() ||
      currentMsgDate.getFullYear() !== prevMsgDate.getFullYear()
    );
  };

  const addSystemMessage = (content) => {
    if (!selectedConversation) return;
    const message = {
      senderId: "system",
      content,
      type: "system",
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, message]);
    setLastMessages((prev) => ({
      ...prev,
      [selectedConversation.conversationId]: message,
    }));
    socketRef.current.emit("sendMessage", {
      conversationId: selectedConversation.conversationId,
      senderId: "system",
      receiverId: selectedConversation.friendId,
      content,
      type: "system",
      timestamp: message.timestamp,
    });
  };

  const addCallEndMessage = (status) => {
    if (!selectedConversation || !callStartTime) return;
    const endTime = new Date();
    const durationMs = endTime - callStartTime;
    const totalSeconds = Math.floor(durationMs / 1000);
    addSystemMessage(`${status}: ${totalSeconds} giây`);
  };

  const getThemeName = (color) => {
    const theme = themes.find((t) => t.color === color);
    return theme ? theme.name : "Mặc định";
  };

  return (
    <div style={styles.container}>
      <ToastContainer />
      <audio ref={ringtoneRef} preload="auto" />
      <div style={styles.mainContent}>
        <div style={styles.sidebar}>
          <h2 style={styles.title}>Bạn bè</h2>
          {conversations.length > 0 ? (
            conversations.map((conv) => {
              const lastMessage = lastMessages[conv.conversationId];
              const isUnread = unreadMessages[conv.conversationId];
              const isOwnMessage = lastMessage?.senderId === currentUser;
              const senderName = isOwnMessage ? "Bạn" : conv.friendName;
              const messagePreview = getMessagePreview(lastMessage);
              return (
                <div
                  key={conv.conversationId}
                  style={{
                    ...styles.conversation,
                    backgroundColor:
                      selectedConversation?.conversationId === conv.conversationId
                        ? "#e0e0e0"
                        : "transparent",
                  }}
                  onClick={() => {
                    setSelectedConversation(conv);
                    setUnreadMessages((prev) => ({
                      ...prev,
                      [conv.conversationId]: false,
                    }));
                  }}
                >
                  <div
                    style={{
                      ...styles.avatar,
                      backgroundColor: conv.theme || "#0078FF",
                    }}
                  >
                    {conv.friendName.charAt(0).toUpperCase()}
                  </div>
                  <div style={styles.friendInfo}>
                    <span
                      style={{
                        ...styles.friendName,
                        fontWeight: isUnread ? "bold" : "500",
                      }}
                    >
                      {conv.friendName}
                    </span>
                    {lastMessage && (
                      <span
                        style={{
                          ...styles.lastMessage,
                          fontWeight: isUnread ? "bold" : "normal",
                        }}
                      >
                        {senderName}: {messagePreview}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <p style={styles.emptyText}>Chưa có bạn bè</p>
          )}
        </div>
        <div style={styles.chatArea}>
          {selectedConversation ? (
            <>
              <div style={styles.chatHeader}>
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: selectedConversation.theme || "#0078FF",
                  }}
                >
                  {selectedConversation.friendName.charAt(0).toUpperCase()}
                </div>
                <h2
                  style={styles.friendNameClickable}
                  onClick={() => setShowSettingsModal(true)}
                >
                  {selectedConversation.friendName}
                </h2>
                <div style={styles.callButtons}>
                  <button
                    onClick={() => handleStartCall("voice")}
                    style={styles.callButton}
                    disabled={callState}
                    title="Gọi thoại"
                  >
                    📞
                  </button>
                  <button
                    onClick={() => handleStartCall("video")}
                    style={styles.callButton}
                    disabled={callState}
                    title="Gọi video"
                  >
                    📹
                  </button>
                </div>
              </div>
              {showSearchBar && (
                <div style={styles.searchArea}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm tin nhắn..."
                    style={styles.searchInput}
                  />
                  {searchQuery && (
                    <button
                      onClick={handleClearSearch}
                      style={styles.clearSearchButton}
                    >
                      Xóa
                    </button>
                  )}
                  <button
                    onClick={handleCancelSearch}
                    style={styles.cancelSearchButton}
                  >
                    Hủy
                  </button>
                </div>
              )}
              <div style={styles.messages}>
                {filteredMessages.map((msg, index) => {
                  const isOwnMessage = msg.senderId === currentUser;
                  const senderName = isOwnMessage
                    ? "Bạn"
                    : selectedConversation.friendName;
                  const filteredContent = filterMessageContent(msg.content);
                  const currentMsgDate = new Date(msg.timestamp);
                  const prevMsg = index > 0 ? filteredMessages[index - 1] : null;
                  const prevMsgDate = prevMsg ? new Date(prevMsg.timestamp) : null;
                  const showDate = isDifferentDay(currentMsgDate, prevMsgDate);

                  return (
                    <div key={index}>
                      {showDate && (
                        <div style={styles.dateDivider}>
                          {formatDate(currentMsgDate)}
                        </div>
                      )}
                      <div
                        style={{
                          ...styles.messageContainer,
                          alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                        }}
                      >
                        <div
                          style={{
                            ...styles.message,
                            backgroundColor: isOwnMessage
                              ? selectedConversation.theme || "#FFFFE0"
                              : "#FFFFFF",
                            borderColor: isOwnMessage
                              ? "transparent"
                              : selectedConversation.theme || "#e0e0e0",
                            color: isOwnMessage ? "#000000" : "#333333",
                            boxShadow: isOwnMessage
                              ? "0 2px 4px rgba(0, 0, 0, 0.2)"
                              : "0 2px 4px rgba(0, 0, 0, 0.1)",
                            ...(searchQuery &&
                            filteredContent
                              .toLowerCase()
                              .includes(searchQuery.toLowerCase())
                              ? styles.highlightedMessage
                              : {}),
                          }}
                        >
                          {msg.status === "deleted" && msg.senderId === currentUser ? (
                            <i style={styles.statusText}>Tin nhắn đã bị xóa</i>
                          ) : msg.type === "recalled" ? (
                            <i style={styles.statusText}>Tin nhắn đã được thu hồi</i>
                          ) : msg.type === "system" ? (
                            <span style={styles.systemMessage}>
                              {filteredContent}
                            </span>
                          ) : (
                            <>
                              <div style={styles.senderName}>{senderName}</div>
                              {msg.forwardedFrom && (
                                <div style={styles.forwarded}>
                                  Chuyển tiếp từ: {msg.forwardedName || msg.forwardedFrom}
                                </div>
                              )}
                              {msg.type === "image" ? (
                                <img
                                  src={msg.content}
                                  alt="Hình ảnh"
                                  style={styles.imagePreview}
                                  onError={() => toast.error("Không thể tải hình ảnh")}
                                />
                              ) : msg.type === "audio" ? (
                                <audio controls style={styles.audioPlayer}>
                                  <source
                                    src={msg.content}
                                    type={
                                      msg.content.endsWith(".mp3")
                                        ? "audio/mpeg"
                                        : msg.content.endsWith(".wav")
                                        ? "audio/wav"
                                        : "audio/ogg"
                                    }
                                  />
                                  Trình duyệt của bạn không hỗ trợ thẻ audio.
                                </audio>
                              ) : msg.type === "video" ? (
                                <video controls style={styles.videoPlayer}>
                                  <source
                                    src={msg.content}
                                    type={
                                      msg.content.endsWith(".mp4")
                                        ? "video/mp4"
                                        : msg.content.endsWith(".webm")
                                        ? "video/webm"
                                        : "video/quicktime"
                                    }
                                  />
                                  Trình duyệt của bạn không hỗ trợ thẻ video.
                                </video>
                              ) : msg.type === "file" ? (
                                <a
                                  href={msg.content}
                                  download
                                  style={styles.fileLink}
                                >
                                  Tệp: {msg.content.split("/").pop()}
                                </a>
                              ) : (
                                <span style={styles.messageContent}>
                                  {filteredContent}
                                </span>
                              )}
                              <div style={styles.timestamp}>
                                {new Date(msg.timestamp).toLocaleTimeString()}
                              </div>
                              {isOwnMessage &&
                                msg.status !== "deleted" &&
                                msg.type !== "recalled" && (
                                  <div style={styles.actions}>
                                    <button
                                      onClick={() => handleRecallMessage(msg.timestamp)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor:
                                          selectedConversation.theme || "#e0e0e0",
                                      }}
                                    >
                                      Thu hồi
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(msg.timestamp)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor:
                                          selectedConversation.theme || "#e0e0e0",
                                      }}
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() => handleForwardMessage(msg)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor:
                                          selectedConversation.theme || "#e0e0e0",
                                      }}
                                    >
                                      Chuyển tiếp
                                    </button>
                                  </div>
                                )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
              <div style={styles.inputArea}>
                {showEmojiPicker && (
                  <div style={styles.emojiPicker}>
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={styles.emojiButton}
                >
                  😊
                </button>
                <label
                  style={styles.fileButton}
                  title="Chọn file JPG, PNG, GIF, MP3, WAV, OGG, MP4, AVI, MKV, WEBM, MOV (tối đa 50MB)"
                >
                  📎
                  <input
                    type="file"
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                    accept="image/jpeg,image/png,image/gif,audio/mpeg,audio/wav,audio/ogg,video/mp4,video/avi,video/x-matroska,video/webm,video/quicktime"
                  />
                </label>
                {filePreview && (
                  <div
                    style={{
                      marginRight: "10px",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {filePreviewType === "image" && (
                      <img
                        src={filePreview}
                        alt="Preview"
                        style={{ maxWidth: "100px", maxHeight: "100px" }}
                      />
                    )}
                    {filePreviewType === "audio" && (
                      <audio
                        controls
                        src={filePreview}
                        style={{ maxWidth: "100px" }}
                      />
                    )}
                    {filePreviewType === "video" && (
                      <video
                        controls
                        src={filePreview}
                        style={{ maxWidth: "100px", maxHeight: "100px" }}
                      />
                    )}
                    <button
                      onClick={() => {
                        setFile(null);
                        setFilePreview(null);
                        setFilePreviewType(null);
                      }}
                      style={{ marginLeft: "5px", color: "red" }}
                    >
                      Xóa
                    </button>
                  </div>
                )}
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Nhập tin nhắn..."
                  style={styles.input}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  style={{
                    ...styles.sendButton,
                    backgroundColor: selectedConversation.theme || "#0078FF",
                  }}
                >
                  Gửi
                </button>
              </div>
            </>
          ) : (
            <div style={styles.emptyChat}>
              Chọn một cuộc trò chuyện để bắt đầu
            </div>
          )}
        </div>
      </div>

      {(callState === "incoming" || callState === "outgoing" || callState === "active") && (
        <div style={styles.callModal}>
          <div style={styles.callModalContent}>
            <div style={styles.callModalHeader}>
              <div
                style={{
                  ...styles.avatar,
                  backgroundColor: selectedConversation?.theme || "#0078FF",
                  width: "80px",
                  height: "80px",
                  fontSize: "32px",
                  margin: "0 auto 15px",
                  border: "3px solid #ffffff",
                  boxShadow: "0 4px 8px rgba(0, 0, 0, 0.2)",
                }}
              >
                {selectedConversation.friendName.charAt(0).toUpperCase()}
              </div>
              <h2 style={styles.modalTitle}>
                {callState === "incoming"
                  ? `${selectedConversation.friendName} đang gọi ${callType === "video" ? "video" : "thoại"}`
                  : `Đang gọi ${callType === "video" ? "video" : "thoại"} với ${selectedConversation.friendName}`}
              </h2>
<p style={styles.callStatus}>
  {callState === "incoming"
    ? "Cuộc gọi đến"
    : callState === "outgoing"
    ? "Đang chờ phản hồi..."
    : `Cuộc gọi đang bắt đầu :${formatDuration(callDuration)}`}
</p>
            </div>
            {callType === "video" && callState === "active" && (
              <div style={styles.videoContainer}>
                <video
                  ref={remoteVideoRef}
                  autoPlay
                  playsInline
                  style={styles.remoteVideo}
                />
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  style={styles.localVideo}
                />
              </div>
            )}
            {callState === "incoming" && (
              <div style={styles.callButtons}>
                <button
                  onClick={handleAcceptCall}
                  style={{
                    ...styles.acceptButton,
                    backgroundColor: selectedConversation?.theme || "#28a745",
                  }}
                >
                  Chấp nhận
                </button>
                <button
                  onClick={handleRejectCall}
                  style={styles.rejectButton}
                >
                  Từ chối
                </button>
              </div>
            )}
            {(callState === "outgoing" || callState === "active") && (
              <button
                onClick={handleEndCall}
                style={styles.endCallButton}
              >
                Kết thúc
              </button>
            )}
          </div>
        </div>
      )}

      {showSettingsModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Tùy chỉnh cuộc trò chuyện</h2>
            <div style={styles.profileHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: selectedConversation?.theme || "#0078FF",
                    width: "40px",
                    height: "40px",
                    fontSize: "18px",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {selectedConversation.friendName.charAt(0).toUpperCase()}
                </div>
                <h3 style={styles.profileHeaderName}>
                  {selectedConversation.friendName}
                </h3>
              </div>
            </div>
            <div style={styles.settingsOptions}>
              {[
                { text: "Tìm kiếm tin nhắn", icon: "🔍", action: handleShowSearchBar },
                { text: "Đổi chủ đề", icon: "🎨", action: () => setShowThemeModal(true) },
                {
                  text: "Đặt biệt hiệu",
                  icon: "✏️",
                  action: () => setShowNicknameModal(true),
                },
                { text: "Xem hồ sơ", icon: "👤", action: () => setShowProfileModal(true) },
                {
                  text: "Ảnh/Video & Tệp",
                  icon: "📷",
                  action: handleShowSharedMedia,
                },
              ].map((option, index) => (
                <button
                  key={option.text}
                  style={{
                    ...styles.settingsButton,
                    borderBottom: index < 4 ? "1px solid #e0e0e0" : "none",
                  }}
                  onClick={() => {
                    setShowSettingsModal(false);
                    option.action();
                  }}
                >
                  <span style={styles.settingsIcon}>{option.icon}</span> {option.text}
                </button>
              ))}
            </div>
            <button
              style={styles.cancelButton}
              onClick={() => setShowSettingsModal(false)}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {showThemeModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Chọn chủ đề màu sắc</h2>
            <div style={styles.themeOptions}>
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  style={{
                    ...styles.themeButton,
                    backgroundColor: theme.color,
                  }}
                  onClick={() => handleChangeTheme(theme.color)}
                >
                  <span style={styles.themeIcon}>{theme.icon}</span> {theme.name}
                </button>
              ))}
            </div>
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowThemeModal(false);
                setShowSettingsModal(true);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {showNicknameModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Đặt biệt hiệu</h2>
            <div style={styles.inputWrapper}>
              <span style={styles.inputIcon}>✏️</span>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Nhập biệt hiệu..."
                style={styles.nicknameInput}
              />
            </div>
            <div style={styles.modalActions}>
              <button
                onClick={handleSetNickname}
                style={{
                  ...styles.actionButton,
                  backgroundColor: selectedConversation?.theme || "#0078FF",
                  color: "#ffffff",
                }}
              >
                Lưu
              </button>
              <button
                style={styles.cancelButton}
                onClick={() => {
                  setShowNicknameModal(false);
                  setNickname("");
                  setShowSettingsModal(true);
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}

      {showProfileModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>Hồ sơ</h2>
            {profile ? (
              <div style={styles.profileContent}>
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: selectedConversation?.theme || "#0078FF",
                    width: "80px",
                    height: "80px",
                    fontSize: "32px",
                    margin: "0 auto 15px",
                    border: "3px solid #ffffff",
                    boxShadow: "0 4px 8px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {(profile.name || profile.username || "").charAt(0).toUpperCase()}
                </div>
                <h3 style={styles.profileName}>
                  <span style={styles.profileIcon}>👤</span>{" "}
                  {profile.name || profile.username || "Không có tên"}
                </h3>
                <div style={styles.profileField}>
                  <span style={styles.profileIcon}>📞</span>
                  <span style={styles.profileInfo}>
                    {profile.phone || "Không có số điện thoại"}
                  </span>
                </div>
                <div style={styles.profileField}>
                  <span style={styles.profileIcon}>✉️</span>
                  <span style={styles.profileInfo}>
                    {profile.email || "Không có email"}
                  </span>
                </div>
                <div style={styles.profileField}>
                  <span style={styles.profileIcon}>ℹ️</span>
                  <span style={styles.profileInfo}>
                    {profile.status || "Không có trạng thái"}
                  </span>
                </div>
              </div>
            ) : (
              <p style={styles.emptyText}>Đang tải...</p>
            )}
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowProfileModal(false);
                setShowSettingsModal(true);
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showSharedMedia && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              <span style={styles.modalIcon}>📷</span> Ảnh/Video & Tệp
            </h2>
            <div style={styles.sharedMediaContainer}>
              {messages.some((msg) =>
                ["image", "video", "audio", "file"].includes(msg.type)
              ) ? (
                <div style={styles.mediaGrid}>
                  {messages
                    .filter((msg) =>
                      ["image", "video", "audio", "file"].includes(msg.type)
                    )
                    .map((msg, index) => (
                      <div key={index} style={styles.mediaItem}>
                        {msg.type === "image" && (
                          <img
                            src={msg.content}
                            alt="Shared media"
                            style={styles.sharedImage}
                            onClick={() => handleMediaClick(msg)}
                            onError={() => toast.error("Không thể tải hình ảnh")}
                          />
                        )}
                        {msg.type === "video" && (
                          <video
                            src={msg.content}
                            style={styles.sharedVideo}
                            onClick={() => handleMediaClick(msg)}
                          />
                        )}
                        {msg.type === "audio" && (
                          <audio
                            controls
                            src={msg.content}
                            style={styles.sharedAudio}
                          />
                        )}
                        {msg.type === "file" && (
                          <a
                            href={msg.content}
                            download
                            style={styles.sharedFileLink}
                          >
                            Tệp: {msg.content.split("/").pop()}
                          </a>
                        )}
                        <div style={styles.mediaTimestamp}>
                          {new Date(msg.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                </div>
              ) : (
                <p style={styles.emptyText}>
                  Chưa có ảnh, video hoặc tệp nào được gửi
                </p>
              )}
            </div>
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowSharedMedia(false);
                setShowSettingsModal(true);
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}

      {showMediaPreview && selectedMedia && (
        <div style={styles.mediaPreviewModal}>
          <div style={styles.mediaPreviewContent}>
            <button
              style={styles.closeMediaPreviewButton}
              onClick={() => {
                setShowMediaPreview(false);
                setSelectedMedia(null);
              }}
            >
              ✕
            </button>
            {selectedMedia.type === "image" && (
              <img
                src={selectedMedia.content}
                alt="Media preview"
                style={styles.mediaPreviewImage}
                onError={() => toast.error("Không thể tải hình ảnh")}
              />
            )}
            {selectedMedia.type === "video" && (
              <video
                controls
                autoPlay
                playsInline
                src={selectedMedia.content}
                style={styles.mediaPreviewVideo}
              />
            )}
            <div style={styles.mediaPreviewTimestamp}>
              {new Date(selectedMedia.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      )}

      {showForwardModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <h2 style={styles.modalTitle}>
              <span style={styles.modalIcon}>↩️</span> Chọn cuộc trò chuyện để chuyển tiếp
            </h2>
            {conversations.length <= 1 ? (
              <p style={styles.emptyText}>Không có cuộc trò chuyện nào khác</p>
            ) : (
              conversations
                .filter(
                  (conv) =>
                    conv.conversationId !== selectedConversation?.conversationId
                )
                .map((conv) => (
                  <div
                    key={conv.conversationId}
                    style={styles.conversationOption}
                    onClick={() => handleForwardToConversation(conv)}
                  >
                    <div
                      style={{
                        ...styles.avatar,
                        backgroundColor: conv.theme || "#007bff",
                      }}
                    >
                      {conv.friendName.charAt(0).toUpperCase()}
                    </div>
                    <span style={styles.friendName}>{conv.friendName}</span>
                  </div>
                ))
            )}
            <button
              style={styles.cancelButton}
              onClick={() => {
                setShowForwardModal(false);
                setForwardMessage(null);
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    backgroundColor: "#f5f5f5",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    width: "100%",
    overflow: "hidden",
  },
  mainContent: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: "300px",
    backgroundColor: "#ffffff",
    borderRight: "1px solid #e0e0e0",
    padding: "20px",
    overflowY: "auto",
    boxShadow: "2px 0 5px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#333333",
  },
  conversation: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    marginBottom: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  avatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#0078FF",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    marginRight: "10px",
  },
  friendInfo: {
    flex: 1,
    overflow: "hidden",
  },
  friendName: {
    fontSize: "16px",
    fontWeight: "500",
    color: "#333333",
    display: "block",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  lastMessage: {
    fontSize: "13px",
    color: "#666666",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    marginTop: "4px",
    display: "block",
  },
  emptyText: {
    fontSize: "16px",
    color: "#666666",
    textAlign: "center",
    marginTop: "20px",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    backgroundColor: "#ffffff",
  },
  chatHeader: {
    display: "flex",
    alignItems: "center",
    padding: "15px 20px",
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "#fafafa",
    minHeight: "60px",
  },
  friendNameClickable: {
    fontSize: "18px",
    fontWeight: "500",
    color: "#333333",
    cursor: "pointer",
    transition: "color 0.2s",
  },
  callButtons: {
    marginLeft: "auto",
    display: "flex",
    gap: "10px",
  },
  callButton: {
    padding: "8px",
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    transition: "color 0.2s",
    ":hover": {
      color: "#0078FF",
    },
  },
  searchArea: {
    padding: "10px 20px",
    borderBottom: "1px solid #e0e0e0",
    backgroundColor: "#fafafa",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  searchInput: {
    flex: 1,
    padding: "10px 15px",
    borderRadius: "20px",
    border: "1px solid #ddd",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
  },
  clearSearchButton: {
    padding: "8px 12px",
    backgroundColor: "#e0e0e0",
    color: "#333333",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#d0d0d0",
    },
  },
  cancelSearchButton: {
    padding: "8px 12px",
    backgroundColor: "#ff4d4f",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#e63946",
    },
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "20px",
    backgroundColor: "#f0f2f5",
    maxHeight: "calc(100vh - 180px)",
  },
  dateDivider: {
    textAlign: "center",
    fontSize: "12px",
    color: "#666666",
    margin: "20px 0",
    padding: "10px",
    backgroundColor: "#e0e0e0",
    borderRadius: "10px",
  },
  messageContainer: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "70%",
    marginBottom: "20px",
  },
  message: {
    padding: "12px 18px",
    borderRadius: "15px",
    position: "relative",
    border: "1px solid",
    transition: "all 0.2s",
  },
  highlightedMessage: {
    backgroundColor: "#fffacd",
  },
  senderName: {
    fontSize: "12px",
    fontWeight: "600",
    marginBottom: "6px",
  },
  messageContent: {
    fontSize: "14px",
    lineHeight: "1.4",
    wordBreak: "break-word",
  },
  forwarded: {
    fontSize: "12px",
    color: "#666666",
    marginBottom: "6px",
    fontStyle: "italic",
  },
  systemMessage: {
    fontSize: "13px",
    color: "#606060",
    fontStyle: "italic",
    textAlign: "center",
  },
  fileLink: {
    color: "#0078FF",
    textDecoration: "none",
    fontSize: "14px",
  },
  imagePreview: {
    maxWidth: "200px",
    maxHeight: "200px",
    borderRadius: "10px",
    marginTop: "5px",
  },
  audioPlayer: {
    maxWidth: "200px",
    marginTop: "5px",
  },
  videoPlayer: {
    maxWidth: "300px",
    maxHeight: "200px",
    borderRadius: "10px",
    marginTop: "5px",
  },
  timestamp: {
    fontSize: "11px",
    marginTop: "6px",
    textAlign: "right",
    color: "#999999",
  },
  statusText: {
    fontSize: "12px",
    color: "#888888",
    fontStyle: "italic",
  },
  actions: {
    display: "flex",
    gap: "8px",
    marginTop: "8px",
  },
  actionButton: {
    padding: "6px 12px",
    fontSize: "12px",
    border: "none",
    borderRadius: "5px",
    cursor: "pointer",
    color: "#ffffff",
    transition: "filter 0.2s",
    ":hover": {
      filter: "brightness(90%)",
    },
  },
  inputArea: {
    display: "flex",
    alignItems: "center",
    padding: "15px 20px",
    borderTop: "1px solid #e0e0e0",
    backgroundColor: "#ffffff",
    boxShadow: "0 -2px 5px rgba(0,0,0,0.05)",
    minHeight: "60px",
  },
  emojiPicker: {
    position: "absolute",
    bottom: "120px",
    zIndex: 1000,
  },
  input: {
    flex: 1,
    padding: "12px 15px",
    borderRadius: "20px",
    border: "1px solid #ddd",
    marginRight: "10px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "#ffffff",
  },
  sendButton: {
    padding: "12px 24px",
    backgroundColor: "#0078FF",
    color: "#ffffff",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
  },
  emojiButton: {
    padding: "10px",
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    marginRight: "10px",
    transition: "color 0.2s",
    ":hover": {
      color: "#0078FF",
    },
  },
  fileButton: {
    padding: "10px",
    background: "none",
    border: "none",
    fontSize: "20px",
    cursor: "pointer",
    marginRight: "10px",
    transition: "color 0.2s",
    ":hover": {
      color: "#0078FF",
    },
  },
  emptyChat: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#666666",
    fontSize: "16px",
  },
  modal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    padding: "25px",
    borderRadius: "15px",
    width: "400px",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.15)",
  },
  modalTitle: {
    fontSize: "22px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#333333",
    textAlign: "center",
    borderBottom: "1px solid #e0e0e0",
    paddingBottom: "10px",
  },
  modalIcon: {
    fontSize: "20px",
    marginRight: "8px",
  },
  profileHeader: {
    marginBottom: "20px",
  },
  profileHeaderName: {
    fontSize: "20px",
    fontWeight: "600",
    color: "#333333",
    margin: 0,
  },
  settingsOptions: {
    marginBottom: "20px",
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    padding: "12px 15px",
    background: "none",
    border: "none",
    borderBottom: "1px solid #e0e0e0",
    fontSize: "16px",
    color: "#333333",
    cursor: "pointer",
    textAlign: "left",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#f0f0f0",
    },
  },
  settingsIcon: {
    marginRight: "10px",
    fontSize: "20px",
  },
  themeOptions: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "10px",
    marginBottom: "20px",
  },
  themeButton: {
    padding: "12px",
    border: "none",
    borderRadius: "8px",
    color: "#ffffff",
    fontSize: "14px",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "filter 0.2s",
    ":hover": {
      filter: "brightness(90%)",
    },
  },
  themeIcon: {
    marginRight: "8px",
    fontSize: "18px",
  },
  inputWrapper: {
    display: "flex",
    alignItems: "center",
    marginBottom: "20px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    padding: "8px",
    backgroundColor: "#fafafa",
  },
  inputIcon: {
    fontSize: "20px",
    marginRight: "10px",
    color: "#666666",
  },
  nicknameInput: {
    flex: 1,
    padding: "10px",
    border: "none",
    borderRadius: "5px",
    fontSize: "14px",
    outline: "none",
    backgroundColor: "transparent",
  },
  modalActions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  cancelButton: {
    padding: "10px 20px",
    backgroundColor: "#e0e0e0",
    color: "#333333",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#d0d0d0",
    },
  },
  profileContent: {
    marginBottom: "20px",
  },
  profileField: {
    display: "flex",
    alignItems: "center",
    marginBottom: "10px",
  },
  profileIcon: {
    fontSize: "20px",
    marginRight: "10px",
    color: "#666666",
  },
  profileInfo: {
    fontSize: "14px",
    color: "#333333",
  },
  profileName: {
    fontSize: "18px",
    fontWeight: "500",
    color: "#333333",
    marginBottom: "15px",
    display: "flex",
    alignItems: "center",
  },
  sharedMediaContainer: {
    maxHeight: "400px",
    overflowY: "auto",
    marginBottom: "20px",
  },
  mediaGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
    gap: "10px",
  },
  mediaItem: {
    position: "relative",
    cursor: "pointer",
  },
  sharedImage: {
    width: "100%",
    height: "100px",
    objectFit: "cover",
    borderRadius: "8px",
  },
  sharedVideo: {
    width: "100%",
    height: "100px",
    objectFit: "cover",
    borderRadius: "8px",
  },
  sharedAudio: {
    width: "100%",
  },
  sharedFileLink: {
    display: "block",
    fontSize: "14px",
    color: "#0078FF",
    textDecoration: "none",
    wordBreak: "break-all",
  },
  mediaTimestamp: {
    fontSize: "12px",
    color: "#666666",
    textAlign: "center",
    marginTop: "5px",
  },
  mediaPreviewModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  mediaPreviewContent: {
    position: "relative",
    maxWidth: "90%",
    maxHeight: "90%",
  },
  mediaPreviewImage: {
    maxWidth: "100%",
    maxHeight: "80vh",
    borderRadius: "10px",
  },
  mediaPreviewVideo: {
    maxWidth: "100%",
    maxHeight: "80vh",
    borderRadius: "10px",
  },
  mediaPreviewTimestamp: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    color: "#ffffff",
    padding: "5px 10px",
    borderRadius: "5px",
    fontSize: "12px",
  },
  closeMediaPreviewButton: {
    position: "absolute",
    top: "-30px",
    right: "-30px",
    backgroundColor: "#ffffff",
    color: "#333333",
    border: "none",
    borderRadius: "50%",
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "16px",
    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.2)",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#e0e0e0",
    },
  },
  conversationOption: {
    display: "flex",
    alignItems: "center",
    padding: "10px",
    marginBottom: "10px",
    borderRadius: "8px",
    cursor: "pointer",
    backgroundColor: "#f9f9f9",
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: "#e0e0e0",
    },
  },
  callModal: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1100,
    backdropFilter: "blur(5px)",
  },
  callModalContent: {
    backgroundColor: "#ffffff",
    borderRadius: "15px",
    padding: "20px",
    width: "400px",
    maxWidth: "90%",
    textAlign: "center",
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.3)",
    animation: "slideIn 0.3s ease-out",
  },
  callModalHeader: {
    marginBottom: "20px",
  },
  callStatus: {
    fontSize: "16px",
    color: "#666666",
    marginTop: "10px",
  },
  videoContainer: {
    position: "relative",
    width: "100%",
    height: "300px",
    backgroundColor: "#000000",
    borderRadius: "10px",
    overflow: "hidden",
    marginBottom: "20px",
  },
  remoteVideo: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  localVideo: {
    position: "absolute",
    bottom: "10px",
    right: "10px",
    width: "120px",
    height: "90px",
    borderRadius: "8px",
    border: "2px solid #ffffff",
    objectFit: "cover",
  },
  acceptButton: {
    padding: "12px 24px",
    backgroundColor: "#28a745",
    color: "#ffffff",
    border: "none",
    borderRadius: "25px",
    cursor: "pointer",
    fontSize: "16px",
    marginRight: "10px",
    transition: "filter 0.2s",
    ":hover": {
      filter: "brightness(90%)",
    },
  },
  rejectButton: {
    padding: "12px 24px",
    backgroundColor: "#dc3545",
    color: "#ffffff",
    border: "none",
    borderRadius: "25px",
    cursor: "pointer",
    fontSize: "16px",
    transition: "filter 0.2s",
    ":hover": {
      filter: "brightness(90%)",
    },
  },
  endCallButton: {
    padding: "12px 24px",
    backgroundColor: "#dc3545",
    color: "#ffffff",
    border: "none",
    borderRadius: "25px",
    cursor: "pointer",
    fontSize: "16px",
    width: "100%",
    transition: "filter 0.2s",
    ":hover": {
      filter: "brightness(90%)",
    },
  },
};

// Thêm keyframes cho animation
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = `
  @keyframes slideIn {
    from { transform: translateY(-50px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;
document.head.appendChild(styleSheet);

export default Chats;