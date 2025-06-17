import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import io from "socket.io-client";
import EmojiPicker from "emoji-picker-react";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import GroupManagement from "./GroupManagement";
import SimplePeer from "simple-peer";

axios.interceptors.request.use((config) => {
  console.log("Sending request:", config);
  return config;
});

function Groups() {
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [filePreviewType, setFilePreviewType] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMembersLoading, setIsMembersLoading] = useState(false);
  const [showManagement, setShowManagement] = useState(false);
  const [userNames, setUserNames] = useState({});
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem("chatTheme") || "light");
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSharedMedia, setShowSharedMedia] = useState(false);
  const [showMediaPreview, setShowMediaPreview] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [groupMembers, setGroupMembers] = useState({});
  const [showMembersModal, setShowMembersModal] = useState(false);
  const [showNicknameModal, setShowNicknameModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [newNickname, setNewNickname] = useState("");
  const [lastMessages, setLastMessages] = useState({});
  const [unreadMessages, setUnreadMessages] = useState({});
  const [callActive, setCallActive] = useState(false);
  const [peers, setPeers] = useState({});
  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const myVideoRef = useRef(null);
  const peerVideoRefs = useRef({});

  const themes = {
    light: {
      chatBackground: "#f0f2f5",
      messageOwn: "#0078FF",
      messageOther: "#ffffff",
      textColor: "#1a3c61",
      inputBackground: "#ffffff",
      inputBorder: "#d1d9e6",
      headerBackground: "linear-gradient(90deg, #f9fafb, #ffffff)",
    },
    dark: {
      chatBackground: "#18191a",
      messageOwn: "#0084ff",
      messageOther: "#3a3b3c",
      textColor: "#e4e6eb",
      inputBackground: "#3a3b3c",
      inputBorder: "#4a4b4c",
      headerBackground: "linear-gradient(90deg, #242526, #18191a)",
    },
    blue: {
      chatBackground: "#e6f0fa",
      messageOwn: "#0078FF",
      messageOther: "#ffffff",
      textColor: "#1a3c61",
      inputBackground: "#ffffff",
      inputBorder: "#d1d9e6",
      headerBackground: "linear-gradient(90deg, #e6f0fa, #d6e6ff)",
    },
    purple: {
      chatBackground: "#f0e7fa",
      messageOwn: "#6f42c1",
      messageOther: "#ffffff",
      textColor: "#1a3c61",
      inputBackground: "#ffffff",
      inputBorder: "#d1d9e6",
      headerBackground: "linear-gradient(90deg, #f0e7fa, #e6d6ff)",
    },
    pink: {
      chatBackground: "#fae7f0",
      messageOwn: "#e83e8c",
      messageOther: "#ffffff",
      textColor: "#1a3c61",
      inputBackground: "#ffffff",
      inputBorder: "#d1d9e6",
      headerBackground: "linear-gradient(90deg, #fae7f0, #ffd6e6)",
    },
  };

  useEffect(() => {
    localStorage.setItem("chatTheme", theme);
  }, [theme]);

  const fetchFriendNames = async () => {
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/contacts/friends`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      const friendMap = {};
      if (Array.isArray(response.data)) {
        response.data.forEach((friend) => {
          if (friend.friendId && friend.friendName) {
            friendMap[friend.friendId] = friend.friendName;
          }
        });
      }
      setUserNames((prev) => ({ ...prev, ...friendMap }));
    } catch (error) {
      console.error("Error fetching friends:", error);
      toast.error("Không thể lấy danh sách bạn bè");
    }
  };

  const fetchMemberDetails = async (groupId) => {
    if (!groupId) return;
    console.log("Fetching members for groupId:", groupId);
    setIsMembersLoading(true);
    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      if (!tokens?.accessToken) {
        throw new Error("Không tìm thấy token xác thực");
      }
      const response = await axios.get(`${process.env.REACT_APP_API_URL}/groups/${groupId}/members`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      console.log("Response from members API:", response.data);
      if (response.data && Array.isArray(response.data)) {
        const memberMap = response.data.reduce((acc, member) => {
          if (member.userId) {
            acc[member.userId] = {
              name: member.nickname || member.name || userNames[member.userId] || "Không xác định",
              avatar: member.avatar || "👤",
              role: member.role || "member",
            };
          }
          return acc;
        }, {});
        setGroupMembers((prev) => ({ ...prev, [groupId]: memberMap }));
      } else {
        setGroupMembers((prev) => ({ ...prev, [groupId]: {} }));
        toast.error("Dữ liệu thành viên không hợp lệ");
      }
    } catch (error) {
      console.error("Error fetching group members:", error);
      let errorMessage = "Không thể lấy danh sách thành viên nhóm";
      if (error.response) {
        if (error.response.status === 401) {
          errorMessage = "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại";
          setTimeout(() => (window.location.href = "/login"), 2000);
        } else if (error.response.status === 403) {
          errorMessage = "Bạn không có quyền xem thành viên nhóm này";
        } else if (error.response.status === 404) {
          errorMessage = "Nhóm không tồn tại hoặc endpoint chưa được hỗ trợ";
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message.includes("Network Error")) {
        errorMessage = "Lỗi mạng, vui lòng kiểm tra kết nối";
      }
      toast.error(errorMessage);
      setGroupMembers((prev) => ({ ...prev, [groupId]: {} }));
    } finally {
      setIsMembersLoading(false);
    }
  };

  const getSenderName = (senderId, groupId) => {
    if (senderId === currentUser) return "Bạn";
    if (!senderId) return "Không xác định";
    const memberName = groupId && groupMembers[groupId]?.[senderId]?.name;
    const userName = userNames[senderId];
    return memberName || userName || senderId.slice(0, 8);
  };

  const getMessagePreview = (message) => {
    if (!message || !message.content) return "Chưa có tin nhắn";
    if (message.status === "deleted") return "Đã xóa";
    if (message.type === "recalled") return "Đã thu hồi";
    if (message.type === "image" || message.type === "video") return "Tệp";
    return message.content.length > 20
      ? message.content.substring(0, 20) + "..."
      : message.content;
  };

  const moveGroupToTop = (groupId) => {
    setGroups((prev) => {
      const groupIndex = prev.findIndex((g) => g.groupId === groupId);
      if (groupIndex === -1) return prev;
      const group = prev[groupIndex];
      const updatedGroups = [...prev];
      updatedGroups.splice(groupIndex, 1);
      const newGroups = [group, ...updatedGroups];
      localStorage.setItem("groupOrder", JSON.stringify(newGroups.map(g => g.groupId)));
      return newGroups;
    });
  };

  useEffect(() => {
    if (!selectedGroup || !currentUser) return;
    fetchFriendNames();
    fetchMemberDetails(selectedGroup.groupId);
  }, [selectedGroup, currentUser]);

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.accessToken) {
      console.log("No token found, redirecting to login");
      window.location.href = "/login";
      return;
    }

    const fetchUserInfo = async () => {
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/auth/user`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        setCurrentUser(response.data.username);
      } catch (error) {
        console.error("Error fetching user info:", error);
        toast.error("Không thể lấy thông tin người dùng");
        window.location.href = "/login";
      }
    };

    fetchUserInfo();
  }, []);

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.accessToken || !currentUser) return;

    const fetchGroupsAndMessages = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/groups`, {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        });
        let fetchedGroups = response.data;
        
        const savedOrder = JSON.parse(localStorage.getItem("groupOrder")) || [];
        if (savedOrder.length > 0) {
          fetchedGroups = [...fetchedGroups].sort((a, b) => {
            const aIndex = savedOrder.indexOf(a.groupId);
            const bIndex = savedOrder.indexOf(b.groupId);
            if (aIndex === -1 && bIndex === -1) return 0;
            if (aIndex === -1) return 1;
            if (bIndex === -1) return -1;
            return aIndex - bIndex;
          });
        }
        
        setGroups(fetchedGroups);

        const lastMessagesTemp = {};
        for (const group of fetchedGroups) {
          try {
            const msgResponse = await axios.get(
              `${process.env.REACT_APP_API_URL}/groups/${group.groupId}/messages`,
              {
                headers: { Authorization: `Bearer ${tokens.accessToken}` },
              }
            );
            lastMessagesTemp[group.groupId] =
              msgResponse.data.length > 0
                ? msgResponse.data[msgResponse.data.length - 1]
                : null;
          } catch (error) {
            console.error(`Lỗi khi lấy tin nhắn cho nhóm ${group.groupId}:`, error);
            lastMessagesTemp[group.groupId] = null;
          }
        }
        setLastMessages(lastMessagesTemp);
      } catch (error) {
        console.error("Lỗi khi làm mới danh sách nhóm:", error.response?.data || error.message);
        toast.error("Không thể làm mới danh sách nhóm: " + (error.response?.data?.error || error.message));
      } finally {
        setIsLoading(false);
      }
    };

    fetchGroupsAndMessages();
    window.addEventListener("groupCreated", fetchGroupsAndMessages);
    return () => window.removeEventListener("groupCreated", fetchGroupsAndMessages);
  }, [currentUser]);

  useEffect(() => {
    const tokens = JSON.parse(localStorage.getItem("tokens"));
    if (!tokens?.accessToken || !currentUser) return;

    socketRef.current = io("http://localhost:5000", {
      auth: { token: tokens.accessToken },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket.IO connected successfully");
      groups.forEach((group) => {
        socketRef.current.emit("joinGroup", { groupId: group.groupId });
      });
    });

    socketRef.current.on("reconnect", () => {
      console.log("Socket.IO reconnected successfully");
      groups.forEach((group) => {
        socketRef.current.emit("joinGroup", { groupId: group.groupId });
      });
    });

    socketRef.current.on("connect_error", (error) => {
      console.error("Socket.IO connection error:", error);
      toast.error("Không thể kết nối đến server chat");
    });

    socketRef.current.on("receiveGroupMessage", (message) => {
      if (message.senderId === currentUser) return;
      if (messages.some((msg) => msg.messageId === message.messageId)) return;

      moveGroupToTop(message.groupId);

      if (message.groupId !== selectedGroup?.groupId) {
        setUnreadMessages((prev) => ({
          ...prev,
          [message.groupId]: (prev[message.groupId] || 0) + 1,
        }));
      }

      setMessages((prev) => [...prev, message]);
      setLastMessages((prev) => ({
        ...prev,
        [message.groupId]: message,
      }));

      if (message.groupId !== selectedGroup?.groupId) {
        const group = groups.find((g) => g.groupId === message.groupId);
        toast.info(`Tin nhắn mới trong nhóm ${group?.name || message.groupId}`);
      }
    });

    socketRef.current.on("groupMessageRecalled", ({ groupId, timestamp }) => {
      if (groupId === selectedGroup?.groupId) {
        setMessages((prev) =>
          prev.map((msg) =>
            msg.timestamp === timestamp ? { ...msg, type: "recalled", status: "recalled" } : msg
          )
        );
        toast.success("Tin nhắn nhóm đã được thu hồi!");
      }
      setLastMessages((prev) => {
        const lastMsg = prev[groupId];
        if (lastMsg && lastMsg.timestamp === timestamp) {
          return { ...prev, [groupId]: { ...lastMsg, type: "recalled", status: "recalled" } };
        }
        return prev;
      });
    });

    socketRef.current.on("groupMessageDeleted", ({ groupId, timestamp }) => {
      if (groupId === selectedGroup?.groupId) {
        setMessages((prev) =>
          prev.map((msg) => (msg.timestamp === timestamp ? { ...msg, status: "deleted" } : msg))
        );
        toast.success("Tin nhắn nhóm đã bị xóa!");
      }
      setLastMessages((prev) => {
        const lastMsg = prev[groupId];
        if (lastMsg && lastMsg.timestamp === timestamp) {
          return { ...prev, [groupId]: { ...lastMsg, status: "deleted" } };
        }
        return prev;
      });
    });

    socketRef.current.on("groupCreated", (group) => {
      setGroups((prev) => {
        if (prev.some((g) => g.groupId === group.groupId)) return prev;
        const newGroups = [group, ...prev];
        localStorage.setItem("groupOrder", JSON.stringify(newGroups.map(g => g.groupId)));
        return newGroups;
      });
      toast.success(`Nhóm ${group.name} đã được tạo!`);
    });

    socketRef.current.on("groupUpdated", ({ groupId, newMember, removedMember, updatedMember, role }) => {
      setGroups((prev) =>
        prev.map((group) =>
          group.groupId === groupId
            ? {
                ...group,
                members: newMember
                  ? [...group.members, { userId: newMember, role: "member" }]
                  : removedMember
                  ? group.members.filter((m) => m.userId !== removedMember)
                  : group.members.map((m) => (m.userId === updatedMember ? { ...m, role } : m)),
              }
            : group
        )
      );
      if (selectedGroup?.groupId === groupId) {
        setSelectedGroup((prev) => ({
          ...prev,
          members: newMember
            ? [...prev.members, { userId: newMember, role: "member" }]
            : removedMember
            ? prev.members.filter((m) => m.userId !== removedMember)
            : prev.members.map((m) => (m.userId === updatedMember ? { ...m, role } : m)),
        }));
      }
      const message = newMember
        ? `${userNames[newMember] || newMember} đã được thêm vào nhóm`
        : removedMember
        ? `${userNames[removedMember] || removedMember} đã rời hoặc bị xóa khỏi nhóm`
        : `${userNames[updatedMember] || updatedMember} giờ là ${role === "admin" ? "admin" : "thành viên"}`;
      toast.info(message);
      fetchMemberDetails(groupId);
    });

    socketRef.current.on("groupDissolved", ({ groupId }) => {
      setGroups((prev) => {
        const newGroups = prev.filter((group) => group.groupId !== groupId);
        localStorage.setItem("groupOrder", JSON.stringify(newGroups.map(g => g.groupId)));
        return newGroups;
      });
      if (selectedGroup?.groupId === groupId) {
        setSelectedGroup(null);
        setMessages([]);
      }
      toast.info("Nhóm đã bị giải tán!");
    });

    socketRef.current.on("nicknameChanged", ({ groupId, userId, newNickname, changerId }) => {
      if (groupId === selectedGroup?.groupId) {
        setGroupMembers((prev) => ({
          ...prev,
          [groupId]: {
            ...prev[groupId],
            [userId]: {
              ...prev[groupId][userId],
              name: newNickname,
            },
          },
        }));
        const changerName = changerId === currentUser ? "Bạn" : getSenderName(changerId, groupId);
        const userName = userId === currentUser ? "bạn" : getSenderName(userId, groupId);
        toast.info(`${changerName} đã đổi biệt hiệu của ${userName} thành ${newNickname}`);
        setMessages((prev) => [
          ...prev,
          {
            groupId,
            senderId: changerId,
            content: `${changerName} đã đổi biệt hiệu của ${userName} thành ${newNickname}`,
            type: "system",
            timestamp: new Date().toISOString(),
            status: "sent",
          },
        ]);
      }
    });

    socketRef.current.on("startVideoCall", ({ groupId }) => {
      if (groupId === selectedGroup?.groupId && !callActive) {
        toast.info("Cuộc gọi video nhóm đang bắt đầu! Nhấn 'Gọi video nhóm' để tham gia.", {
          autoClose: false,
          closeOnClick: true,
          onClick: () => startVideoCall(),
        });
      }
    });

    socketRef.current.on("videoCallEnded", ({ groupId }) => {
      if (groupId === selectedGroup?.groupId && callActive) {
        endVideoCall();
        toast.info("Cuộc gọi video nhóm đã kết thúc.");
      }
    });

    socketRef.current.on("offer", (data) => {
      if (data.groupId === selectedGroup?.groupId && data.receiverId === currentUser) {
        createPeer(data.senderId, currentUser, data.sdp);
      }
    });

    socketRef.current.on("answer", (data) => {
      if (data.groupId === selectedGroup?.groupId && data.receiverId === currentUser) {
        const peer = peers[data.senderId];
        if (peer) peer.signal(data.sdp);
      }
    });

    socketRef.current.on("candidate", (data) => {
      if (data.groupId === selectedGroup?.groupId) {
        const peer = peers[data.senderId];
        if (peer) peer.signal(data.candidate);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, [currentUser, groups, userNames, messages, groupMembers, peers, selectedGroup]);

  useEffect(() => {
    if (!socketRef.current || !groups.length) return;
    groups.forEach((group) => {
      socketRef.current.emit("joinGroup", { groupId: group.groupId });
    });
  }, [groups]);

  useEffect(() => {
    if (!selectedGroup) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      try {
        const tokens = JSON.parse(localStorage.getItem("tokens"));
        const response = await axios.get(
          `${process.env.REACT_APP_API_URL}/groups/${selectedGroup.groupId}/messages`,
          {
            headers: { Authorization: `Bearer ${tokens.accessToken}` },
          }
        );
        setMessages(response.data);
        if (response.data.length > 0) {
          setLastMessages((prev) => ({
            ...prev,
            [selectedGroup.groupId]: response.data[response.data.length - 1],
          }));
        }
      } catch (error) {
        console.error("Error fetching group messages:", error);
        toast.error("Không thể lấy tin nhắn nhóm");
      } finally {
        setIsLoading(false);
      }
    };

    setUnreadMessages((prev) => ({
      ...prev,
      [selectedGroup.groupId]: 0,
    }));

    socketRef.current.emit("joinGroup", { groupId: selectedGroup.groupId });
    fetchMessages();
    setShowSearchBar(false);
    setSearchQuery("");
  }, [selectedGroup]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const getFileType = (fileName) => {
    if (!fileName) return "file";
    if (/\.(jpg|jpeg|png|gif)$/i.test(fileName)) return "image";
    if (/\.(mp4|avi|mkv|webm|mov)$/i.test(fileName)) return "video";
    if (/\.(mp3|wav|ogg)$/i.test(fileName)) return "audio";
    return "file";
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && !file) return;

    let messageContent = newMessage;
    let messageType = "text";

    if (file) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await axios.post(`${process.env.REACT_APP_API_URL}/upload`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
            Authorization: `Bearer ${JSON.parse(localStorage.getItem("tokens")).accessToken}`,
          },
        });
        messageContent = response.data.fileUrl;
        messageType = getFileType(file.name);
      } catch (error) {
        console.error("Error uploading file:", error);
        toast.error("Không thể tải lên tệp");
        return;
      }
    }

    const message = {
      groupId: selectedGroup.groupId,
      senderId: currentUser,
      content: messageContent,
      type: messageType,
      timestamp: new Date().toISOString(),
    };

    socketRef.current.emit("sendGroupMessage", message);
    setMessages((prev) => [...prev, { ...message, status: "sent" }]);
    setLastMessages((prev) => ({
      ...prev,
      [selectedGroup.groupId]: message,
    }));
    moveGroupToTop(selectedGroup.groupId);
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
        toast.error("Tệp quá lớn, vui lòng chọn tệp dưới 50MB");
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
        toast.error("Chỉ hỗ trợ các tệp JPG, PNG, GIF, MP3, WAV, OGG, MP4, AVI, MKV, WEBM, MOV");
        return;
      }
      setFile(selectedFile);
      const previewUrl = URL.createObjectURL(selectedFile);
      setFilePreview(previewUrl);
      setFilePreviewType(getFileType(selectedFile.name));
    }
  };

  const handleRecallMessage = (timestamp) => {
    if (window.confirm("Bạn có chắc chắn muốn thu hồi tin nhắn này?")) {
      socketRef.current.emit("recallGroupMessage", {
        groupId: selectedGroup.groupId,
        timestamp,
      });
    }
  };

const handleDeleteMessage = (timestamp) => {
  if (window.confirm("Bạn có chắc chắn muốn xóa tin nhắn này?")) {
    // Chỉ cập nhật giao diện của người dùng hiện tại
    setMessages((prev) =>
      prev.map((msg) =>
        msg.timestamp === timestamp ? { ...msg, status: "deleted" } : msg
      )
    );
    toast.success("Tin nhắn đã bị xóa!");
  }
};

  const handleForwardMessage = (message) => {
    setForwardMessage(message);
    setShowForwardModal(true);
  };

  const handleForwardToGroup = (newGroupId) => {
    if (!forwardMessage) return;
    socketRef.current.emit("forwardGroupMessage", {
      groupId: selectedGroup.groupId,
      newGroupId,
      content: forwardMessage.content,
      type: forwardMessage.type,
      forwardedFrom: forwardMessage.forwardedFrom,
    });
    toast.success("Tin nhắn đã được chuyển tiếp!");
    setShowForwardModal(false);
    setForwardMessage(null);
  };

  const handleSelectTheme = (newTheme) => {
    setTheme(newTheme);
    setShowThemeModal(false);
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
    if (!content) return "";
    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
    return content.replace(uuidRegex, "").trim();
  };

  const filteredMessages = messages.filter((msg) => {
    if (msg.status === "deleted" || msg.type === "recalled" || msg.type === "system") return true;
    const content = filterMessageContent(msg.content);
    return content.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleShowMembersModal = () => {
    if (!selectedGroup) return;
    setShowSettingsModal(false);
    fetchMemberDetails(selectedGroup.groupId).then(() => {
      setShowMembersModal(true);
    });
  };

  const handleOpenNicknameModal = (userId, currentNickname) => {
    setEditingUserId(userId);
    setNewNickname(currentNickname);
    setShowNicknameModal(true);
  };

  const handleSaveNickname = async () => {
    if (!newNickname.trim()) {
      toast.error("Hãy nhập vào để đổi biệt hiệu");
      return;
    }

    try {
      const tokens = JSON.parse(localStorage.getItem("tokens"));
      const url = `${process.env.REACT_APP_API_URL}/groups/${selectedGroup.groupId}/members/${editingUserId}/nickname`;
      console.log("Attempting to update nickname at URL:", url);

      const response = await axios.put(
        url,
        { nickname: newNickname },
        {
          headers: { Authorization: `Bearer ${tokens.accessToken}` },
        }
      );

      if (response.status === 200) {
        socketRef.current.emit("changeNickname", {
          groupId: selectedGroup.groupId,
          userId: editingUserId,
          newNickname,
          changerId: currentUser,
        });

        setGroupMembers((prev) => ({
          ...prev,
          [selectedGroup.groupId]: {
            ...prev[selectedGroup.groupId],
            [editingUserId]: {
              ...prev[selectedGroup.groupId][editingUserId],
              name: newNickname,
            },
          },
        }));

        setShowNicknameModal(false);
        setEditingUserId(null);
        setNewNickname("");
        toast.success("Đổi biệt hiệu thành công!");
      } else {
        throw new Error(`Cập nhật thất bại với mã trạng thái: ${response.status}`);
      }
    } catch (error) {
      console.error("Error updating nickname:", error.response?.data || error.message);
      let errorMessage = "Không thể cập nhật biệt hiệu";
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = "Endpoint không tồn tại. Vui lòng kiểm tra cấu hình backend hoặc liên hệ quản trị viên.";
        } else if (error.response.status === 400 || error.response.status === 403) {
          errorMessage = error.response.data?.error || "Yêu cầu không hợp lệ hoặc không có quyền";
        } else if (error.response.data?.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error.message.includes("Network Error")) {
        errorMessage = "Lỗi mạng, vui lòng kiểm tra kết nối";
      }
      toast.error(errorMessage);
    }
  };

  const startVideoCall = () => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        const myVideo = myVideoRef.current;
        if (myVideo) {
          myVideo.srcObject = stream;
          myVideo.play();
        }

        socketRef.current.emit("startVideoCall", { groupId: selectedGroup.groupId });

        const newPeers = {};
        selectedGroup.members.forEach((member) => {
          if (member.userId !== currentUser) {
            const peer = new SimplePeer({
              initiator: true,
              trickle: false,
              stream: stream,
            });

            peer.on("signal", (data) => {
              socketRef.current.emit("offer", {
                sdp: data,
                senderId: currentUser,
                receiverId: member.userId,
                groupId: selectedGroup.groupId,
              });
            });

            peer.on("stream", (remoteStream) => {
              if (!peerVideoRefs.current[member.userId]) {
                const video = document.createElement("video");
                video.style.width = "200px";
                video.style.height = "150px";
                video.style.margin = "10px";
                video.autoplay = true;
                peerVideoRefs.current[member.userId] = video;
                document.getElementById("video-container")?.appendChild(video);
              }
              peerVideoRefs.current[member.userId].srcObject = remoteStream;
              peerVideoRefs.current[member.userId].play();
            });

            peer.on("error", (err) => {
              console.error("Peer error:", err);
              toast.error("Lỗi kết nối video với " + getSenderName(member.userId, selectedGroup.groupId));
            });

            newPeers[member.userId] = peer;
          }
        });

        setPeers(newPeers);
        setCallActive(true);
      })
      .catch((err) => {
        console.error("Error accessing media devices:", err);
        toast.error("Không thể truy cập camera hoặc micro");
      });
  };

  const createPeer = (senderId, receiverId, sdp) => {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        const peer = new SimplePeer({
          initiator: false,
          trickle: false,
          stream: stream,
        });

        peer.on("signal", (data) => {
          socketRef.current.emit("answer", {
            sdp: data,
            senderId: receiverId,
            receiverId: senderId,
            groupId: selectedGroup.groupId,
          });
        });

        peer.on("stream", (remoteStream) => {
          if (!peerVideoRefs.current[senderId]) {
            const video = document.createElement("video");
            video.style.width = "200px";
            video.style.height = "150px";
            video.style.margin = "10px";
            video.autoplay = true;
            peerVideoRefs.current[senderId] = video;
            document.getElementById("video-container")?.appendChild(video);
          }
          peerVideoRefs.current[senderId].srcObject = remoteStream;
          peerVideoRefs.current[senderId].play();
        });

        peer.on("error", (err) => {
          console.error("Peer error:", err);
          toast.error("Lỗi kết nối video với " + getSenderName(senderId, selectedGroup.groupId));
        });

        peer.signal(sdp);
        setPeers((prev) => ({ ...prev, [senderId]: peer }));
      })
      .catch((err) => {
        console.error("Error creating peer:", err);
        toast.error("Lỗi khi kết nối video");
      });
  };

  const endVideoCall = () => {
    setCallActive(false);

    Object.entries(peers).forEach(([userId, peer]) => {
      try {
        peer.destroy();
      } catch (err) {
        console.error("Error destroying peer:", err);
      }
    });
    setPeers({});

    if (myVideoRef.current?.srcObject) {
      myVideoRef.current.srcObject.getTracks().forEach((track) => track.stop());
      myVideoRef.current.srcObject = null;
    }

    Object.values(peerVideoRefs.current).forEach((video) => {
      if (video.srcObject) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
      video.remove();
    });
    peerVideoRefs.current = {};

    const videoContainer = document.getElementById("video-container");
    if (videoContainer) {
      videoContainer.innerHTML = "";
    }

    socketRef.current.emit("videoCallEnded", { groupId: selectedGroup.groupId });
  };

  const formatDateLabel = (date) => {
    const today = new Date();
    const messageDate = new Date(date);
    const isToday = messageDate.toDateString() === today.toDateString();
    const isYesterday = new Date(today.setDate(today.getDate() - 1)).toDateString() === messageDate.toDateString();

    if (isToday) return "Hôm nay";
    if (isYesterday) return "Hôm qua";
    return messageDate.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  return (
    <div style={styles.container}>
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={3}
      />
      <div style={styles.mainContent}>
        <div style={styles.sidebar}>
          <h2 style={styles.title}>Nhóm</h2>
          <button style={styles.button} onClick={() => setShowManagement(true)}>
            Tạo Nhóm
          </button>
          {isLoading ? (
            <p style={styles.emptyText}>Đang tải...</p>
          ) : groups.length > 0 ? (
            groups.map((group) => {
              const lastMessage = lastMessages[group.groupId] || {};
              const senderName = getSenderName(lastMessage.senderId, group.groupId);
              const messagePreview = getMessagePreview(lastMessage);
              const unreadCount = unreadMessages[group.groupId] || 0;

              return (
                <div
                  key={group.groupId}
                  style={{
                    ...styles.group,
                    backgroundColor:
                      selectedGroup?.groupId === group.groupId ? "#e0e7ff" : "transparent",
                  }}
                  onClick={() => setSelectedGroup(group)}
                >
                  <div style={styles.avatar}>{group.name.charAt(0).toUpperCase()}</div>
                  <div style={styles.groupInfo}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={styles.groupName}>{group.name}</span>
                      {unreadCount > 0 && (
                        <span style={styles.unreadBadge}>{unreadCount}</span>
                      )}
                    </div>
                    <div style={styles.lastMessage}>
                      <span style={styles.senderName}>{senderName}: </span>
                      <span style={styles.messagePreview}>{messagePreview}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <p style={styles.emptyText}>Không có nhóm nào</p>
          )}
        </div>
        <div style={{ ...styles.chatArea, backgroundColor: themes[theme].chatBackground }}>
          {selectedGroup ? (
            <>
              <div style={{ ...styles.chatHeader, background: themes[theme].headerBackground }}>
                <div style={styles.groupNameWrapper}>
                  <div style={styles.avatar}>{selectedGroup.name.charAt(0).toUpperCase()}</div>
                  <h2
                    style={{ ...styles.groupName, color: themes[theme].textColor, cursor: "pointer" }}
                    onClick={() => setShowSettingsModal(true)}
                  >
                    {selectedGroup.name}
                  </h2>
                </div>
                <div>
                  <button style={styles.manageButton} onClick={() => setShowManagement(true)}>
                    Quản lý Nhóm
                  </button>
                  {!callActive && (
                    <button
                      style={{ ...styles.manageButton, marginLeft: "10px" }}
                      onClick={startVideoCall}
                    >
                      Gọi video nhóm
                    </button>
                  )}
                  {callActive && (
                    <button
                      style={{ ...styles.manageButton, marginLeft: "10px", backgroundColor: "#ff4d4f" }}
                      onClick={endVideoCall}
                    >
                      Kết thúc cuộc gọi
                    </button>
                  )}
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
                    <button onClick={handleClearSearch} style={styles.clearSearchButton}>
                      Xóa
                    </button>
                  )}
                  <button onClick={handleCancelSearch} style={styles.cancelSearchButton}>
                    Hủy
                  </button>
                </div>
              )}
              <div style={styles.messages}>
                {isLoading ? (
                  <p style={{ ...styles.emptyText, color: themes[theme].textColor }}>
                    Đang tải tin nhắn...
                  </p>
                ) : filteredMessages.length === 0 ? (
                  <p style={{ ...styles.emptyText, color: themes[theme].textColor }}>
                    Chưa có tin nhắn nào
                  </p>
                ) : (
                  filteredMessages.map((msg, index) => {
                    const isOwnMessage = msg.senderId === currentUser;
                    const senderName = getSenderName(msg.senderId, selectedGroup.groupId);
                    const filteredContent = filterMessageContent(msg.content);
                    const currentDate = new Date(msg.timestamp).toDateString();
                    const prevMessage = index > 0 ? filteredMessages[index - 1] : null;
                    const prevDate = prevMessage ? new Date(prevMessage.timestamp).toDateString() : null;
                    const showDateLabel = !prevMessage || currentDate !== prevDate;

                    return (
                      <React.Fragment key={index}>
                        {showDateLabel && (
                          <div style={styles.dateLabel}>
                            {formatDateLabel(msg.timestamp)}
                          </div>
                        )}
                        <div
                          style={{
                            ...styles.messageContainer,
                            alignSelf: isOwnMessage ? "flex-end" : "flex-start",
                            animation: "fadeIn 0.3s ease-in",
                          }}
                        >
                          <div
                            style={{
                              ...styles.message,
                              backgroundColor: isOwnMessage
                                ? themes[theme].messageOwn
                                : themes[theme].messageOther,
                              color: isOwnMessage ? "#ffffff" : themes[theme].textColor,
                              border: isOwnMessage ? "none" : `1px solid ${themes[theme].inputBorder}`,
                              ...(searchQuery &&
                              filteredContent.toLowerCase().includes(searchQuery.toLowerCase())
                                ? styles.highlightedMessage
                                : {}),
                            }}
                          >
                            {msg.status === "deleted" ? (
                              <i style={{ ...styles.statusText, color: themes[theme].textColor }}>
                                Tin nhắn đã bị xóa
                              </i>
                            ) : msg.type === "recalled" ? (
                              <i style={{ ...styles.statusText, color: themes[theme].textColor }}>
                                Tin nhắn đã được thu hồi
                              </i>
                            ) : msg.type === "system" ? (
                              <i style={{ ...styles.statusText, color: themes[theme].textColor }}>
                                {msg.content}
                              </i>
                            ) : (
                              <>
                                <div style={{ ...styles.senderName, color: themes[theme].textColor }}>
                                  {senderName}
                                </div>
                                {msg.forwardedFrom && (
                                  <div
                                    style={{
                                      ...styles.forwarded,
                                      color: theme === "dark" ? "#b0b3b8" : "#6c757d",
                                    }}
                                  >
                                    Chuyển tiếp từ: {getSenderName(msg.forwardedFrom, selectedGroup.groupId)}
                                  </div>
                                )}
                                {msg.type === "image" ? (
                                  <img
                                    src={msg.content}
                                    alt="Image"
                                    style={styles.imagePreview}
                                    onClick={() => handleMediaClick(msg)}
                                    onError={(e) => {
                                      console.error("Error loading image:", msg.content);
                                      toast.error("Không thể tải hình ảnh");
                                    }}
                                  />
                                ) : msg.type === "video" ? (
                                  <video
                                    controls
                                    style={styles.videoPlayer}
                                    onClick={() => handleMediaClick(msg)}
                                  >
                                    <source src={msg.content} type={msg.content.endsWith(".mp4") ? "video/mp4" : "video/webm"} />
                                    Trình duyệt của bạn không hỗ trợ phát video.
                                  </video>
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
                                    Trình duyệt của bạn không hỗ trợ phát âm thanh.
                                  </audio>
                                ) : (
                                  <span style={styles.messageContent}>{msg.content}</span>
                                )}
                                <div
                                  style={{
                                    ...styles.timestamp,
                                    color: isOwnMessage
                                      ? "rgba(255,255,255,0.7)"
                                      : theme === "dark"
                                      ? "#b0b3b8"
                                      : "#999999",
                                  }}
                                >
                                  {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                                {isOwnMessage && msg.status !== "deleted" && msg.type !== "recalled" && msg.type !== "system" && (
                                  <div style={styles.actions}>
                                    <button
                                      onClick={() => handleRecallMessage(msg.timestamp)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor: theme === "dark" ? "#4a4b4c" : "#e0e7ff",
                                        color: theme === "dark" ? "#e4e6eb" : "#1a3c61",
                                      }}
                                    >
                                      Thu hồi
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMessage(msg.timestamp)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor: theme === "dark" ? "#4a4b4c" : "#e0e7ff",
                                        color: theme === "dark" ? "#e4e6eb" : "#1a3c61",
                                      }}
                                    >
                                      Xóa
                                    </button>
                                    <button
                                      onClick={() => handleForwardMessage(msg)}
                                      style={{
                                        ...styles.actionButton,
                                        backgroundColor: theme === "dark" ? "#4a4b4c" : "#e0e7ff",
                                        color: theme === "dark" ? "#e4e6eb" : "#1a3c61",
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
                      </React.Fragment>
                    );
                  })
                )}
                {callActive && (
                  <div id="video-container" style={styles.videoContainer}>
                    <video ref={myVideoRef} style={styles.video} muted />
                  </div>
                )}
                <div ref={messagesEndRef} style={{ height: "1px" }} />
              </div>
              <div style={styles.inputArea}>
                {showEmojiPicker && (
                  <div style={styles.emojiPicker}>
                    <EmojiPicker onEmojiClick={handleEmojiClick} />
                  </div>
                )}
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  style={{
                    ...styles.emojiButton,
                    color: themes[theme].textColor,
                  }}
                >
                  😊
                </button>
                <label
                  style={{
                    ...styles.fileButton,
                    color: themes[theme].textColor,
                  }}
                  title="Chọn tệp JPG, PNG, GIF, MP3, WAV, OGG, MP4, AVI, MKV, WEBM, MOV (tối đa 50MB)"
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
                  <div style={{ marginRight: "10px", display: "flex", alignItems: "center" }}>
                    {filePreviewType === "image" && (
                      <img
                        src={filePreview}
                        alt="Preview"
                        style={{ maxWidth: "80px", maxHeight: "80px", borderRadius: "8px" }}
                      />
                    )}
                    {filePreviewType === "video" && (
                      <video
                        controls
                        src={filePreview}
                        style={{ maxWidth: "80px", maxHeight: "80px", borderRadius: "8px" }}
                      />
                    )}
                    {filePreviewType === "audio" && (
                      <audio controls src={filePreview} style={{ maxWidth: "100px" }} />
                    )}
                    <button
                      onClick={() => {
                        setFile(null);
                        setFilePreview(null);
                        setFilePreviewType(null);
                      }}
                      style={{
                        marginLeft: "5px",
                        color: theme === "dark" ? "#ff6b6b" : "#ff4d4f",
                        background: "none",
                        border: "none",
                      }}
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
                  style={{
                    ...styles.input,
                    backgroundColor: themes[theme].inputBackground,
                    borderColor: themes[theme].inputBorder,
                    color: themes[theme].textColor,
                  }}
                  onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                />
                <button
                  onClick={handleSendMessage}
                  style={{
                    ...styles.sendButton,
                    backgroundColor: themes[theme].messageOwn,
                  }}
                >
                  Gửi
                </button>
              </div>
            </>
          ) : (
            <div
              style={{
                ...styles.emptyChat,
                backgroundColor: themes[theme].chatBackground,
                color: themes[theme].textColor,
              }}
            >
              Chọn một nhóm để bắt đầu
            </div>
          )}
        </div>
      </div>
      {showManagement && (
        <GroupManagement
          group={selectedGroup}
          onClose={() => setShowManagement(false)}
          currentUser={currentUser}
          allowNonAdminAddMembers={true}
        />
      )}
      {showSettingsModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Tùy chỉnh cuộc trò chuyện</h2>
            <div style={styles.profileHeader}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div
                  style={{
                    ...styles.avatar,
                    backgroundColor: themes[theme].messageOwn,
                    width: "40px",
                    height: "40px",
                    fontSize: "18px",
                    border: "2px solid #ffffff",
                    boxShadow: "0 2px 4px rgba(0, 0, 0, 0.1)",
                  }}
                >
                  {selectedGroup.name.charAt(0).toUpperCase()}
                </div>
                <h3 style={styles.profileHeaderName}>{selectedGroup.name}</h3>
              </div>
            </div>
            <div style={styles.settingsOptions}>
              {[
                { text: "Tìm kiếm tin nhắn", icon: "🔍", action: handleShowSearchBar },
                { text: "Đổi chủ đề", icon: "🎨", action: () => setShowThemeModal(true) },
                { text: "Xem thành viên", icon: "👥", action: handleShowMembersModal },
                { text: "Ảnh/Video & Tệp", icon: "📷", action: handleShowSharedMedia },
              ].map((option, index) => (
                <button
                  key={option.text}
                  style={{
                    ...styles.settingsButton,
                    borderBottom: index < 3 ? "1px solid #e0e0e0" : "none",
                  }}
                  onClick={() => {
                    option.action();
                    if (option.text !== "Đổi chủ đề") setShowSettingsModal(false);
                  }}
                >
                  <span style={styles.settingsIcon}>{option.icon}</span> {option.text}
                </button>
              ))}
            </div>
            <button style={styles.modalButton} onClick={() => setShowSettingsModal(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}
      {showThemeModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Chọn chủ đề</h2>
            <div style={styles.themePicker}>
              {Object.keys(themes).map((themeName) => (
                <div
                  key={themeName}
                  style={{
                    ...styles.themeOption,
                    backgroundColor: themes[themeName].chatBackground,
                  }}
                  onClick={() => handleSelectTheme(themeName)}
                >
                  {themeName.charAt(0).toUpperCase() + themeName.slice(1)}
                </div>
              ))}
            </div>
            <button style={styles.modalButton} onClick={() => setShowThemeModal(false)}>
              Hủy
            </button>
          </div>
        </div>
      )}
      {showMembersModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Thành viên nhóm</h2>
            {isMembersLoading ? (
              <p style={styles.emptyText}>Đang tải...</p>
            ) : selectedGroup && groupMembers[selectedGroup.groupId] ? (
              Object.keys(groupMembers[selectedGroup.groupId]).length > 0 ? (
                <div style={styles.profileContent}>
                  {Object.entries(groupMembers[selectedGroup.groupId]).map(([userId, member]) => (
                    <div key={userId} style={styles.profileField}>
                      <span style={styles.profileIcon}>{member.avatar}</span>
                      <div style={{ flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={styles.profileInfo}>
                          {member.name}
                          {member.role === "admin" && (
                            <span style={{ color: "#0078FF", fontSize: "12px", marginLeft: "8px" }}>
                              (Admin)
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => handleOpenNicknameModal(userId, member.name)}
                          style={{
                            ...styles.actionButton,
                            padding: "6px 12px",
                            fontSize: "13px",
                          }}
                        >
                          Đổi biệt hiệu
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={styles.emptyText}>Không có thành viên nào</p>
              )
            ) : (
              <p style={styles.emptyText}>Không thể tải danh sách thành viên</p>
            )}
            <button
              style={styles.modalButton}
              onClick={() => {
                setShowMembersModal(false);
                setShowSettingsModal(true);
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
      {showNicknameModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>Đổi biệt hiệu</h2>
            <p style={styles.modalText}>
              Đổi biệt hiệu cho {groupMembers[selectedGroup.groupId][editingUserId]?.name || "thành viên"}
            </p>
            <input
              type="text"
              value={newNickname}
              onChange={(e) => setNewNickname(e.target.value)}
              placeholder="Nhập biệt hiệu mới..."
              style={{
                ...styles.input,
                width: "100%",
                padding: "12px 16px",
                marginBottom: "20px",
                borderRadius: "8px",
              }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                style={{
                  ...styles.modalButton,
                  flex: 1,
                  backgroundColor: "#0078FF",
                }}
                onClick={handleSaveNickname}
              >
                Lưu
              </button>
              <button
                style={{
                  ...styles.modalButton,
                  flex: 1,
                  backgroundColor: "#ff4d4f",
                }}
                onClick={() => {
                  setShowNicknameModal(false);
                  setEditingUserId(null);
                  setNewNickname("");
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {showSharedMedia && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2 style={styles.modalTitle}>
              <span style={styles.modalIcon}>📷</span> Ảnh/Video & Tệp
            </h2>
            <div style={styles.sharedMediaContainer}>
              {messages.some((msg) => ["image", "video", "audio", "file"].includes(msg.type)) ? (
                <div style={styles.mediaGrid}>
                  {messages
                    .filter((msg) => ["image", "video", "audio", "file"].includes(msg.type))
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
                            controls
                            src={msg.content}
                            style={styles.sharedVideo}
                            onClick={() => handleMediaClick(msg)}
                          />
                        )}
                        {msg.type === "audio" && (
                          <audio controls src={msg.content} style={styles.sharedAudio} />
                        )}
                        {msg.type === "file" && (
                          <a href={msg.content} download style={styles.sharedFileLink}>
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
                <p style={styles.emptyText}>Chưa có ảnh, video hoặc tệp nào được gửi</p>
              )}
            </div>
            <button
              style={styles.modalButton}
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
              <video controls autoPlay src={selectedMedia.content} style={styles.mediaPreviewVideo} />
            )}
            <div style={styles.mediaPreviewTimestamp}>
              {new Date(selectedMedia.timestamp).toLocaleString()}
            </div>
          </div>
        </div>
      )}
      {showForwardModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h3 style={{ ...styles.modalTitle, color: themes[theme].textColor }}>
              Chuyển tiếp Tin nhắn
            </h3>
            <p style={{ ...styles.modalText, color: themes[theme].textColor }}>
              Chọn nhóm để chuyển tiếp:
            </p>
            {groups.length <= 1 ? (
              <p style={{ ...styles.emptyText, color: themes[theme].textColor }}>
                Không có nhóm nào khác để chuyển tiếp
              </p>
            ) : (
              groups
                .filter((group) => group.groupId !== selectedGroup?.groupId)
                .map((group) => (
                  <div
                    key={group.groupId}
                    style={styles.groupOption}
                    onClick={() => handleForwardToGroup(group.groupId)}
                  >
                    <div style={styles.avatar}>{group.name.charAt(0).toUpperCase()}</div>
                    <span style={{ ...styles.groupName, color: themes[theme].textColor }}>
                      {group.name}
                    </span>
                  </div>
                ))
            )}
            <button
              style={styles.modalButton}
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
    background: "linear-gradient(135deg, #f0f4f8, #e2e8f0)",
    fontFamily: "'Roboto', sans-serif",
    width: "100%",
    overflow: "hidden",
  },
  mainContent: {
    display: "flex",
    flex: 1,
    overflow: "hidden",
  },
  sidebar: {
    width: "320px",
    background: "linear-gradient(180deg, #ffffff, #f0f4f8)",
    borderRight: "1px solid #e0e7ff",
    padding: "24px",
    overflowY: "auto",
    boxShadow: "2px 0 8px rgba(0,0,0,0.1)",
  },
  title: {
    fontSize: "22px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#1a3c61",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#0078FF",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    marginBottom: "20px",
    transition: "background-color 0.2s",
  },
  group: {
    display: "flex",
    alignItems: "center",
    padding: "12px",
    marginBottom: "12px",
    borderRadius: "12px",
    cursor: "pointer",
    transition: "background-color 0.3s, transform 0.2s",
  },
  avatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    backgroundColor: "#0078FF",
    color: "#ffffff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
    marginRight: "12px",
    transition: "transform 0.2s",
  },
  groupInfo: {
    flex: 1,
  },
  groupName: {
    fontSize: "16px",
    fontWeight: "500",
  },
  lastMessage: {
    display: "flex",
    flexDirection: "row",
    fontSize: "12px",
    color: "#666666",
  },
  senderName: {
    fontWeight: "500",
  },
  messagePreview: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  unreadBadge: {
    backgroundColor: "#ff4d4f",
    color: "#ffffff",
    borderRadius: "12px",
    padding: "2px 8px",
    fontSize: "12px",
    fontWeight: "600",
    lineHeight: "1",
  },
  groupNameWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  emptyText: {
    fontSize: "15px",
    textAlign: "center",
    marginTop: "20px",
  },
  chatArea: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "16px 24px",
    borderBottom: "1px solid rgba(0,0,0,0.1)",
    minHeight: "64px",
  },
  manageButton: {
    padding: "8px 16px",
    backgroundColor: "#0078FF",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "background-color 0.2s, transform 0.1s",
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
  },
  cancelSearchButton: {
    padding: "8px 12px",
    backgroundColor: "#ff4d4f",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
    transition: "filter 0.2s",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: "24px",
    maxHeight: "calc(100vh - 180px)",
    position: "relative",
  },
  messageContainer: {
    display: "flex",
    flexDirection: "column",
    maxWidth: "70%",
    marginBottom: "16px",
  },
  message: {
    padding: "12px 16px",
    borderRadius: "18px",
    position: "relative",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
    transition: "transform 0.2s",
  },
  highlightedMessage: {
    backgroundColor: "#fffacd",
  },
  senderName: {
    fontSize: "13px",
    fontWeight: "600",
    marginBottom: "6px",
  },
  messageContent: {
    fontSize: "15px",
    lineHeight: "1.5",
    wordBreak: "break-word",
  },
  forwarded: {
    fontSize: "12px",
    marginBottom: "6px",
    fontStyle: "italic",
  },
  fileLink: {
    textDecoration: "none",
    fontSize: "14px",
  },
  imagePreview: {
    maxWidth: "240px",
    maxHeight: "240px",
    borderRadius: "10px",
    marginTop: "8px",
    cursor: "pointer",
  },
  audioPlayer: {
    maxWidth: "240px",
    marginTop: "8px",
  },
  videoPlayer: {
    maxWidth: "320px",
    maxHeight: "240px",
    borderRadius: "10px",
    marginTop: "8px",
    cursor: "pointer",
  },
  timestamp: {
    fontSize: "12px",
    marginTop: "8px",
    textAlign: "right",
  },
  statusText: {
    fontSize: "13px",
    fontStyle: "italic",
  },
  actions: {
    display: "flex",
    gap: "10px",
    marginTop: "10px",
  },
  actionButton: {
    padding: "6px 12px",
    fontSize: "13px",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "background-color 0.2s, transform 0.1s",
  },
  inputArea: {
    display: "flex",
    alignItems: "center",
    padding: "16px 24px",
    borderTop: "1px solid rgba(0,0,0,0.1)",
    boxShadow: "0 -2px 8px rgba(0,0,0,0.05)",
    minHeight: "64px",
  },
  emojiPicker: {
    position: "absolute",
    bottom: "80px",
    zIndex: 1000,
  },
  input: {
    flex: 1,
    padding: "12px 16px",
    borderRadius: "20px",
    border: "1px solid",
    marginRight: "12px",
    fontSize: "15px",
    outline: "none",
    transition: "border-color 0.2s, box-shadow 0.2s",
  },
  sendButton: {
    padding: "12px 24px",
    color: "#ffffff",
    border: "none",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "15px",
    fontWeight: "500",
    transition: "background-color 0.2s, transform 0.1s",
  },
  emojiButton: {
    padding: "10px",
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    marginRight: "12px",
    transition: "transform 0.2s",
  },
  fileButton: {
    padding: "10px",
    background: "none",
    border: "none",
    fontSize: "24px",
    cursor: "pointer",
    marginRight: "12px",
    transition: "transform 0.2s",
  },
  emptyChat: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  modalOverlay: {
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
  modal: {
    backgroundColor: "#ffffff",
    padding: "24px",
    borderRadius: "12px",
    width: "400px",
    maxHeight: "80vh",
    overflowY: "auto",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
  },
  modalTitle: {
    fontSize: "20px",
    fontWeight: "600",
    marginBottom: "20px",
    color: "#1a3c61",
  },
  modalIcon: {
    marginRight: "8px",
  },
  modalText: {
    fontSize: "14px",
    marginBottom: "20px",
    color: "#666666",
  },
  profileHeader: {
    marginBottom: "20px",
  },
  profileHeaderName: {
    fontSize: "18px",
    fontWeight: "500",
    color: "#1a3c61",
  },
      settingsOptions: {
      marginBottom: "20px",
    },
    settingsButton: {
      display: "flex",
      alignItems: "center",
      width: "100%",
      padding: "12px 16px",
      background: "none",
      border: "none",
      fontSize: "15px",
      color: "#1a3c61",
      cursor: "pointer",
      transition: "background-color 0.2s",
    },
    settingsIcon: {
      marginRight: "12px",
      fontSize: "18px",
    },
    themePicker: {
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "12px",
      marginBottom: "20px",
    },
    themeOption: {
      padding: "12px",
      borderRadius: "8px",
      textAlign: "center",
      fontSize: "14px",
      fontWeight: "500",
      cursor: "pointer",
      color: "#1a3c61",
      transition: "transform 0.2s, box-shadow 0.2s",
    },
    profileContent: {
      marginBottom: "20px",
    },
    profileField: {
      display: "flex",
      alignItems: "center",
      padding: "12px 0",
      borderBottom: "1px solid #e0e0e0",
    },
    profileIcon: {
      fontSize: "24px",
      marginRight: "12px",
    },
    profileInfo: {
      fontSize: "15px",
      color: "#1a3c61",
    },
    sharedMediaContainer: {
      maxHeight: "400px",
      overflowY: "auto",
      marginBottom: "20px",
    },
    mediaGrid: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
      gap: "12px",
    },
    mediaItem: {
      position: "relative",
    },
    sharedImage: {
      width: "100%",
      height: "100px",
      objectFit: "cover",
      borderRadius: "8px",
      cursor: "pointer",
    },
    sharedVideo: {
      width: "100%",
      height: "100px",
      borderRadius: "8px",
      cursor: "pointer",
    },
    sharedAudio: {
      width: "100%",
    },
    sharedFileLink: {
      fontSize: "14px",
      color: "#0078FF",
      textDecoration: "none",
    },
    mediaTimestamp: {
      fontSize: "12px",
      color: "#666666",
      marginTop: "4px",
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
      zIndex: 2000,
    },
    mediaPreviewContent: {
      position: "relative",
      maxWidth: "90%",
      maxHeight: "90%",
    },
    mediaPreviewImage: {
      maxWidth: "100%",
      maxHeight: "80vh",
      borderRadius: "8px",
    },
    mediaPreviewVideo: {
      maxWidth: "100%",
      maxHeight: "80vh",
      borderRadius: "8px",
    },
    mediaPreviewTimestamp: {
      position: "absolute",
      bottom: "10px",
      right: "10px",
      backgroundColor: "rgba(0, 0, 0, 0.6)",
      color: "#ffffff",
      padding: "4px 8px",
      borderRadius: "4px",
      fontSize: "12px",
    },
    closeMediaPreviewButton: {
      position: "absolute",
      top: "-30px",
      right: "-30px",
      background: "none",
      border: "none",
      color: "#ffffff",
      fontSize: "24px",
      cursor: "pointer",
    },
    groupOption: {
      display: "flex",
      alignItems: "center",
      padding: "12px",
      marginBottom: "12px",
      borderRadius: "12px",
      cursor: "pointer",
      backgroundColor: "#f0f4f8",
      transition: "background-color 0.2s",
    },
    modalButton: {
      width: "100%",
      padding: "12px",
      backgroundColor: "#0078FF",
      color: "#ffffff",
      border: "none",
      borderRadius: "8px",
      cursor: "pointer",
      fontSize: "15px",
      fontWeight: "500",
      transition: "background-color 0.2s",
    },
    videoContainer: {
      display: "flex",
      flexWrap: "wrap",
      justifyContent: "center",
      marginTop: "20px",
    },
    video: {
      width: "200px",
      height: "150px",
      margin: "10px",
      borderRadius: "8px",
      backgroundColor: "#000",
    },
  };

export default Groups;