import { jsxDEV } from "react/jsx-dev-runtime";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import { WebsimSocket, useQuery } from "@websim/use-query";
const room = new WebsimSocket();
function FingerPaintApp() {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentColor, setCurrentColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(5);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [currentPath, setCurrentPath] = useState([]);
  const [lastSync, setLastSync] = useState(0);
  const { data: paintings, loading } = useQuery(room.collection("paintings"));
  const { data: leaderboard, loading: leaderboardLoading } = useQuery(room.query(`
        SELECT p.user_id, u.username, COUNT(*) as total_paintings, 
               SUM(p.likes) as total_likes
        FROM public.paintings p
        JOIN public.user u ON p.user_id = u.id
        GROUP BY p.user_id, u.username
        ORDER BY total_likes DESC, total_paintings DESC
        LIMIT 10
    `));
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight * 0.7;
    redrawCanvas();
  }, [paintings]);
  useEffect(() => {
    const interval = setInterval(() => {
      setLastSync(Date.now());
    }, 7e3);
    return () => clearInterval(interval);
  }, []);
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (paintings) {
      paintings.forEach((painting) => {
        drawPath(ctx, painting.path, painting.color, painting.brushSize);
      });
    }
  };
  const drawPath = (ctx, path, color, size) => {
    if (!path || path.length < 2) return;
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
  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
  return /* @__PURE__ */ jsxDEV("div", { className: "app", children: [
    /* @__PURE__ */ jsxDEV("header", { className: "header", children: [
      /* @__PURE__ */ jsxDEV("h1", { children: "Finger Paint Arena" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 145,
        columnNumber: 17
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
          lineNumber: 146,
          columnNumber: 17
        },
        this
      )
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 144,
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
          lineNumber: 155,
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
            lineNumber: 169,
            columnNumber: 29
          },
          this
        )) }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 167,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "brush-controls", children: [
          /* @__PURE__ */ jsxDEV("label", { children: [
            "Brush Size: ",
            brushSize,
            "px"
          ] }, void 0, true, {
            fileName: "<stdin>",
            lineNumber: 179,
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
              lineNumber: 180,
              columnNumber: 25
            },
            this
          )
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 178,
          columnNumber: 21
        }, this),
        /* @__PURE__ */ jsxDEV("button", { onClick: clearCanvas, className: "clear-btn", children: "\u{1F5D1}\uFE0F Clear" }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 189,
          columnNumber: 21
        }, this)
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 166,
        columnNumber: 17
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 154,
      columnNumber: 13
    }, this),
    showLeaderboard && /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-panel", children: [
      /* @__PURE__ */ jsxDEV("h2", { children: "\u{1F3C6} Global Leaderboard" }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 197,
        columnNumber: 21
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "sync-status", children: [
        "Last sync: ",
        new Date(lastSync).toLocaleTimeString()
      ] }, void 0, true, {
        fileName: "<stdin>",
        lineNumber: 198,
        columnNumber: 21
      }, this),
      leaderboardLoading ? /* @__PURE__ */ jsxDEV("div", { className: "loading", children: "Loading..." }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 202,
        columnNumber: 25
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-list", children: leaderboard?.map((user, index) => /* @__PURE__ */ jsxDEV("div", { className: "leaderboard-item", children: [
        /* @__PURE__ */ jsxDEV("span", { className: "rank", children: [
          "#",
          index + 1
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 207,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "username", children: user.username }, void 0, false, {
          fileName: "<stdin>",
          lineNumber: 208,
          columnNumber: 37
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "stats", children: [
          user.total_paintings,
          " paintings \u2022 ",
          user.total_likes,
          " likes"
        ] }, void 0, true, {
          fileName: "<stdin>",
          lineNumber: 209,
          columnNumber: 37
        }, this)
      ] }, user.user_id, true, {
        fileName: "<stdin>",
        lineNumber: 206,
        columnNumber: 33
      }, this)) }, void 0, false, {
        fileName: "<stdin>",
        lineNumber: 204,
        columnNumber: 25
      }, this)
    ] }, void 0, true, {
      fileName: "<stdin>",
      lineNumber: 196,
      columnNumber: 17
    }, this)
  ] }, void 0, true, {
    fileName: "<stdin>",
    lineNumber: 143,
    columnNumber: 9
  }, this);
}
const root = createRoot(document.getElementById("root"));
root.render(/* @__PURE__ */ jsxDEV(FingerPaintApp, {}, void 0, false, {
  fileName: "<stdin>",
  lineNumber: 223,
  columnNumber: 13
}));
