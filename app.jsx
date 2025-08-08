import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
import confetti from "canvas-confetti";
const room = new WebsimSocket();
function FingerPaintApp() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [lastSync, setLastSync] = useState(0);
  const [protectedUsers, setProtectedUsers] = useState({});
  const [projectId, setProjectId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const { data: paintings, loading } = useQuery(room.collection("paintings"));
  const { data: leaderboard, loading: leaderboardLoading } = useQuery(room.query(`
        SELECT p.user_id, u.username, 
               COUNT(*) FILTER (WHERE p.path IS NOT NULL AND NOT (jsonb_array_length(CASE WHEN jsonb_typeof(p.path) = 'array' THEN p.path ELSE '[]'::jsonb END) = 1 AND (p.path->0->>'x')::float = 0 AND (p.path->0->>'y')::float = 0)) as total_paintings,
               COUNT(*) FILTER (WHERE p.path IS NOT NULL AND jsonb_array_length(CASE WHEN jsonb_typeof(p.path) = 'array' THEN p.path ELSE '[]'::jsonb END) = 1 AND (p.path->0->>'x')::float = 0 AND (p.path->0->>'y')::float = 0) as total_clears,
               SUM(p.likes) as total_likes
        FROM public.paintings p
        JOIN public.user u ON p.user_id = u.id
        GROUP BY p.user_id, u.username
        ORDER BY total_likes DESC, total_paintings DESC
        LIMIT 10
    `));
  const fetchProtectedUsers = async (pId) => {
    if (!pId) return;
    try {
      const response = await fetch(`/api/v1/projects/${pId}/comments?only_tips=true&first=100`);
      const data = await response.json();
      const userTips = {};
      data.comments.data.forEach(({ comment }) => {
        const userId = comment.author.id;
        if (!userTips[userId]) {
          userTips[userId] = { totalCredits: 0, lastTipDate: /* @__PURE__ */ new Date(0) };
        }
        userTips[userId].totalCredits += comment.card_data.credits_spent;
        const tipDate = new Date(comment.created_at);
        if (tipDate > userTips[userId].lastTipDate) {
          userTips[userId].lastTipDate = tipDate;
        }
      });
      const protectedUsersData = {};
      for (const userId in userTips) {
        const protectionDays = Math.floor(userTips[userId].totalCredits / 10);
        const expiryDate = new Date(userTips[userId].lastTipDate);
        expiryDate.setDate(expiryDate.getDate() + protectionDays);
        if (expiryDate > /* @__PURE__ */ new Date()) {
          protectedUsersData[userId] = expiryDate.toISOString();
        }
      }
      setProtectedUsers(protectedUsersData);
    } catch (error) {
      console.error("Failed to fetch tip comments:", error);
    }
  };
  useEffect(() => {
    const init = async () => {
      const project = await window.websim.getCurrentProject();
      const user = await window.websim.getCurrentUser();
      setProjectId(project.id);
      setCurrentUser(user);
      fetchProtectedUsers(project.id);
    };
    init();
    const handleComment = (e) => {
      if (e.detail?.comment?.card_data?.type === "tip_comment") {
        if (projectId) fetchProtectedUsers(projectId);
        if (e.detail.comment.author.id === currentUser?.id) {
          confetti({
            particleCount: 150,
            spread: 180,
            origin: { y: 0.6 }
          });
        }
      }
    };
    window.addEventListener("comment:created", handleComment);
    return () => window.removeEventListener("comment:created", handleComment);
  }, [projectId, currentUser?.id]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
    redrawCanvas();
  }, [paintings, showLeaderboard, protectedUsers]);
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync(Date.now());
    }, 7e3);
    return () => clearInterval(interval);
  }, []);
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (paintings && paintings.length > 0) {
      const clearEvents = paintings.filter((p) => p.path && p.path.length === 1 && p.path[0].x === 0 && p.path[0].y === 0).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastClearTime = clearEvents.length > 0 ? new Date(clearEvents[0].created_at) : /* @__PURE__ */ new Date(0);
      const paintingsToDraw = paintings.filter((p) => {
        const isAfterClear = new Date(p.created_at) > lastClearTime;
        const isClearEvent = p.path && p.path.length === 1 && p.path[0].x === 0 && p.path[0].y === 0;
        if (protectedUsers[p.user_id]) {
          return !isClearEvent;
        }
        return !isClearEvent && isAfterClear;
      });
      paintingsToDraw.forEach((painting) => {
        drawPath(ctx, painting.path, painting.color, painting.brushSize);
      });
    }
  };
  const drawPath = (ctx, path, color, size) => {
    if (!path || !Array.isArray(path) || path.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(path[0].x, path[0].y);
    for (let i = 1; i < path.length; i++) {
      ctx.lineTo(path[i].x, path[i].y);
    }
    ctx.stroke();
  };
  const startDrawing = useCallback((e) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = e.touches ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    setCurrentPath([{ x, y }]);
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, []);
  const draw = useCallback((e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();
    const x = e.touches ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = e.touches ? e.touches[0].clientY - rect.top : e.clientY - rect.top;
    setCurrentPath((prev) => [...prev, { x, y }]);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
  }, [isDrawing, currentColor, brushSize]);
  const stopDrawing = useCallback(async (e) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentPath.length > 1) {
      await room.collection("paintings").create({
        path: currentPath,
        color: currentColor,
        brushSize,
        likes: 0
      });
    }
    setCurrentPath([]);
  }, [isDrawing, currentPath, currentColor, brushSize]);
  const likePainting = async (paintingId) => {
    await room.collection("paintings").upsert({
      id: paintingId,
      likes: paintings.find((p) => p.id === paintingId).likes + 1
    });
  };
  const clearCanvas = async () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    await room.collection("paintings").create({
      path: [{ x: 0, y: 0 }],
      color: "#FFFFFF",
      brushSize: 0,
      likes: 0
    });
  };
  const handleTip = () => {
    window.websim.postComment({
      content: "I'm protecting my art! \u{1F3A8}\u2728",
      credits: 10
    });
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "app", children: [
    /* @__PURE__ */ jsxDEV("header", { className: "header", children: [
      /* @__PURE__ */ jsxDEV("h1", { children: "Finger Paint Arena" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 255,
        columnNumber: 17
      }, this),
      /* @__PURE__ */ jsxDEV("div", { children: [
        /* @__PURE__ */ jsxDEV("button", { onClick: handleTip, className: "tip-btn", children: "\u{1F48E} Tip to Protect Art" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 257,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: "leaderboard-btn",
            onClick: () => setShowLeaderboard(!showLeaderboard),
            children: "\u{1F3C6} Leaderboard"
          },
          void 0,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 260,
            columnNumber: 21
          },
          this
        )
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 256,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 254,
      columnNumber: 13
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: `canvas-container ${showLeaderboard ? "shrink" : ""}`, children: [
      /* @__PURE__ */ jsxDEV(
        "canvas",
        {
          ref: canvasRef,
          onTouchStart: startDrawing,
          onTouchMove: draw,
          onTouchEnd: stopDrawing,
          onMouseDown: startDrawing,
          onMouseMove: draw,
          onMouseUp: stopDrawing,
          className: "drawing-canvas"
        },
        void 0,
        false,
        {
          fileName: "<stdin>",
          lineNumber: 270,
          columnNumber: 17
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("div", { className: "controls", children: [
        /* @__PURE__ */ jsxDEV("div", { className: "color-picker", children: ["#000000", "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFFFFF"].map((color) => /* @__PURE__ */ jsxDEV(
          "button",
          {
            className: `color-btn ${currentColor === color ? "active" : ""}`,
            style: { backgroundColor: color },
            onClick: () => setCurrentColor(color)
          },
          color,
          false,
          {
            fileName: "<stdin>",
            lineNumber: 284,
            columnNumber: 29
          },
          this
        )) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 282,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "brush-controls", children: [
          /* @__PURE__ */ jsxDEV("label", { children: [
            "Brush Size: ",
            brushSize,
            "px"
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 294,
            columnNumber: 25
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "range",
              min: "1",
              max: "50",
              value: brushSize,
              onChange: (e) => setBrushSize(parseInt(e.target.value))
            },
            void 0,
            false,
            {
              fileName: "<stdin>",
              lineNumber: 295,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 293,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: clearCanvas, className: "clear-btn", children: "\u{1F5D1}\uFE0F Clear" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 304,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 281,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 269,
      columnNumber: 13
    }, this),
    showLeaderboard && /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-panel", children: [
      /* @__PURE__ */ jsxDEV("h2", { children: "\u{1F3C6} Global Leaderboard" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 312,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "sync-status", children: [
        "Last sync: ",
        new Date(lastSync).toLocaleTimeString()
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 313,
        columnNumber: 21
      }, this),
      leaderboardLoading ? /* @__PURE__ */ jsxDEV("div", { className: "loading", children: "Loading..." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 317,
        columnNumber: 25
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-list", children: leaderboard?.map((user, index) => /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-item", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "rank", children: [
          "#",
          index + 1
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 322,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "username", children: user.username }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 323,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "stats", children: [
          user.total_paintings || 0,
          " drawings \u2022 ",
          user.total_clears || 0,
          " clears \u2022 ",
          user.total_likes || 0,
          " likes"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 324,
          columnNumber: 37
        }, this)
      ] }, user.user_id, true, {
        fileName: "<stdin>",
        lineNumber: 321,
        columnNumber: 33
      }, this)) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 319,
        columnNumber: 25
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 311,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 253,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(FingerPaintApp, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 338,
  columnNumber: 13
}));
