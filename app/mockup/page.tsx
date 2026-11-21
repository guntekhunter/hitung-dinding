"use client";

import { useEffect, useRef, Suspense, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams, useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";

import TextureSelector from "../components/TextureSelector";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading Mockup...</div>
    </div>
  ),
});

// Helper for solving homography
function solveHomography(
  src: { x: number; y: number }[],
  dst: { x: number; y: number }[],
) {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const x = src[i].x;
    const y = src[i].y;
    const u = dst[i].x;
    const v = dst[i].y;
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
  }

  // Gaussian elimination
  for (let i = 0; i < 8; i++) {
    let maxEl = Math.abs(A[i][i]);
    let maxRow = i;
    for (let k = i + 1; k < 8; k++) {
      if (Math.abs(A[k][i]) > maxEl) {
        maxEl = Math.abs(A[k][i]);
        maxRow = k;
      }
    }

    const tmp = A[maxRow];
    A[maxRow] = A[i];
    A[i] = tmp;

    const pivot = A[i][i];
    if (pivot === 0) return null;

    for (let k = i; k < 9; k++) {
      A[i][k] /= pivot;
    }

    for (let j = 0; j < 8; j++) {
      if (i !== j) {
        const factor = A[j][i];
        for (let k = i; k < 9; k++) {
          A[j][k] -= factor * A[i][k];
        }
      }
    }
  }

  const H = [
    A[0][8],
    A[3][8],
    0,
    A[6][8],
    A[1][8],
    A[4][8],
    0,
    A[7][8],
    0,
    0,
    1,
    0,
    A[2][8],
    A[5][8],
    0,
    1,
  ];

  return `matrix3d(${H.join(",")})`;
}

import {
  Plus,
  Copy,
  Minus,
  ImagePlus,
  Save,
  Download,
  Image as ImageIcon,
  ArrowLeft,
  Folder,
} from "lucide-react";

function MockupPageContent() {
  const wallEditorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();

  const {
    loadProject,
    fetchProducts,
    walls,
    activeWallId,
    setActiveWall,
    setIsColoringPreview,
    setCeilingTraps,
  } = useCanvasStore();
  const hasCeiling = walls.some((w) => w.type === "ceiling");
  const ceilingWall = walls.find((w) => w.type === "ceiling");
  const ceilingTraps = ceilingWall?.ceilingTraps || [];

  // Always start with loading = true to prevent hydration mismatch between server and client
  // (searchParams is empty on server during static generation, but populated on client)
  const [loadingProject, setLoadingProject] = useState(true);

  // Multiple Mockups State
  const [mockupsList, setMockupsList] = useState<
    {
      id: string;
      name: string;
      bgImage: string | null;
      includedWalls: string[];
      wallCorners: Record<string, { x: number; y: number }[]>;
    }[]
  >([
    {
      id: "1",
      name: "Mockup 1",
      bgImage: null,
      includedWalls: [],
      wallCorners: {},
    },
  ]);
  const [activeMockupId, setActiveMockupId] = useState("1");

  // Background Image State
  const [bgImage, setBgImage] = useState<string | null>(null);

  // Scene state
  const [includedWalls, setIncludedWalls] = useState<string[]>([]);
  const [wallCorners, setWallCorners] = useState<
    Record<string, { x: number; y: number }[]>
  >({});

  // Keep track of dynamic box sizes for each included wall
  const [boxDimensions, setBoxDimensions] = useState<
    Record<
      string,
      { width: number; height: number; minX: number; minY: number }
    >
  >({});

  // History for undo/redo of corners
  const [cornersPast, setCornersPast] = useState<
    Record<string, { x: number; y: number }[]>[]
  >([]);
  const [cornersFuture, setCornersFuture] = useState<
    Record<string, { x: number; y: number }[]>[]
  >([]);

  const [draggingHandle, setDraggingHandle] = useState<{
    wallId: string;
    index: number;
  } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const zoomRef = useRef(zoom);
  const panRef = useRef(panOffset);
  useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  useEffect(() => { panRef.current = panOffset; }, [panOffset]);
  const isPanningRef = useRef(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const panStartOffsetRef = useRef({ x: 0, y: 0 });
  const spaceDownRef = useRef(false);
  const [topHandleKey, setTopHandleKey] = useState<string | null>(null);
  const [wallDropdownOpen, setWallDropdownOpen] = useState(false);
  const wallDropdownRef = useRef<HTMLDivElement>(null);

  // Close wall dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        wallDropdownRef.current &&
        !wallDropdownRef.current.contains(e.target as Node)
      ) {
        setWallDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, []);
  const [canvasDims, setCanvasDims] = useState({ width: 3000, height: 3000 });

  useEffect(() => {
    if (!bgImage) {
      setCanvasDims({ width: 3000, height: 3000 });
      return;
    }
    const img = new window.Image();
    img.src = bgImage;
    img.onload = () => {
      if (img.width && img.height) {
        const aspect = img.width / img.height;
        if (aspect > 1) {
          setCanvasDims({ width: 3000, height: 3000 / aspect });
        } else {
          setCanvasDims({ width: 3000 * aspect, height: 3000 });
        }
      }
    };
  }, [bgImage]);

  // Initialize/Update bounds when included walls change
  useEffect(() => {
    const newDims = { ...boxDimensions };
    let updatedCorners = { ...wallCorners };
    let changed = false;

    includedWalls.forEach((wallId) => {
      const wData = walls.find((w) => w.id === wallId);
      if (wData && wData.points.length >= 3) {
        let w, h;
        if (!newDims[wallId]) {
          const xs = wData.points.map((p) => p.x);
          const ys = wData.points.map((p) => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);

          w = Math.max(10, maxX - minX);
          h = Math.max(10, maxY - minY);

          newDims[wallId] = { width: w, height: h, minX, minY };
          changed = true;
        } else {
          w = newDims[wallId].width;
          h = newDims[wallId].height;
        }

        if (!updatedCorners[wallId]) {
          const scale = Math.min(800 / w, 500 / h, 1);
          const displayW = w * scale;
          const displayH = h * scale;

          // offset slightly based on how many walls are included to avoid full overlap
          const offset = Object.keys(updatedCorners).length * 40;
          const startX =
            Math.max(50, (window.innerWidth - displayW) / 2) + offset;
          const startY = 100 + offset;

          updatedCorners[wallId] = [
            { x: startX, y: startY },
            { x: startX + displayW, y: startY },
            { x: startX + displayW, y: startY + displayH },
            { x: startX, y: startY + displayH },
          ];
          changed = true;
        }
      }
    });

    if (changed) {
      setBoxDimensions(newDims);
      setWallCorners(updatedCorners);
    }
  }, [includedWalls, walls, boxDimensions, wallCorners]);

  useEffect(() => {
    async function init() {
      await fetchProducts();

      if (id) {
        const { data, error } = await supabase
          .from("projects")
          .select("data")
          .eq("id", id)
          .single();

        if (data && !error) {
          loadProject(id, data.data);
          if (data.data.mockupScenes && data.data.mockupScenes.length > 0) {
            setMockupsList(data.data.mockupScenes);
            const first = data.data.mockupScenes[0];
            setActiveMockupId(first.id);
            setBgImage(first.bgImage);
            setIncludedWalls(first.includedWalls);
            setWallCorners(first.wallCorners);
          } else if (data.data.mockupScene) {
            setBgImage(data.data.mockupScene.bgImage || null);
            setIncludedWalls(data.data.mockupScene.includedWalls || []);
            setWallCorners(data.data.mockupScene.wallCorners || {});
            setMockupsList([
              {
                id: "1",
                name: "Mockup 1",
                bgImage: data.data.mockupScene.bgImage || null,
                includedWalls: data.data.mockupScene.includedWalls || [],
                wallCorners: data.data.mockupScene.wallCorners || {},
              },
            ]);
          } else if (data.data.mockups) {
            // legacy migration
            const firstId = Object.keys(data.data.mockups)[0];
            if (firstId) {
              setBgImage(data.data.mockups[firstId].bgImage);
              setIncludedWalls([firstId]);
              setWallCorners({ [firstId]: data.data.mockups[firstId].corners });
              setMockupsList([
                {
                  id: "1",
                  name: "Mockup 1",
                  bgImage: data.data.mockups[firstId].bgImage,
                  includedWalls: [firstId],
                  wallCorners: {
                    [firstId]: data.data.mockups[firstId].corners,
                  },
                },
              ]);
            }
          }
        }
        setLoadingProject(false);
      }
    }
    init();

    // Enable coloring preview mode for the Mockup to hide labels and sizes
    setIsColoringPreview(true);
    return () => setIsColoringPreview(false);
  }, [id, loadProject, fetchProducts, setIsColoringPreview]);

  // Handle Dragging - uses refs so the effect doesn't re-register on every zoom/pan change
  const draggingRef = useRef(draggingHandle);
  useEffect(() => { draggingRef.current = draggingHandle; }, [draggingHandle]);

  const handlePointerDown = useCallback((wallId: string, index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setCornersPast((prev) => [...prev, wallCorners]);
    setCornersFuture([]);
    setDraggingHandle({ wallId, index });
    setTopHandleKey(`${wallId}-${index}`);
  }, [wallCorners]);

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const dh = draggingRef.current;
      if (!dh) return;
      e.preventDefault();
      const s = zoomRef.current;
      const p = panRef.current;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      // Convert screen position to image coordinates
      const x = (e.clientX - rect.left - p.x) / s;
      const y = (e.clientY - rect.top - p.y) / s;
      setWallCorners((prev) => {
        const newCorners = { ...prev };
        if (newCorners[dh.wallId]) {
          const arr = [...newCorners[dh.wallId]];
          arr[dh.index] = { x, y };
          newCorners[dh.wallId] = arr;
        }
        return newCorners;
      });
    };

    const handlePointerUp = () => {
      setDraggingHandle(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, []);

  // Use a ref for wallCorners so undo/redo closures always have the latest value
  const wallCornersRef = useRef(wallCorners);
  useEffect(() => {
    wallCornersRef.current = wallCorners;
  }, [wallCorners]);

  const cornersPastRef = useRef(cornersPast);
  useEffect(() => {
    cornersPastRef.current = cornersPast;
  }, [cornersPast]);

  const cornersFutureRef = useRef(cornersFuture);
  useEffect(() => {
    cornersFutureRef.current = cornersFuture;
  }, [cornersFuture]);

  // Handle Undo/Redo keydown globally for MockupPage
  useEffect(() => {
    const handleUndoRedo = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" || e.key === "Z") {
          if (e.shiftKey) {
            // Redo
            if (cornersFutureRef.current.length > 0) {
              e.preventDefault();
              e.stopImmediatePropagation();
              setCornersFuture((prev) => {
                const next = prev[0];
                const current = wallCornersRef.current;
                setCornersPast((past) => [...past, current]);
                setWallCorners(next);
                return prev.slice(1);
              });
            }
          } else {
            // Undo
            if (cornersPastRef.current.length > 0) {
              e.preventDefault();
              e.stopImmediatePropagation();
              setCornersPast((prev) => {
                const previous = prev[prev.length - 1];
                const current = wallCornersRef.current;
                setCornersFuture((future) => [current, ...future]);
                setWallCorners(previous);
                return prev.slice(0, -1);
              });
            }
          }
        } else if (e.key === "y" || e.key === "Y") {
          if (cornersFutureRef.current.length > 0) {
            e.preventDefault();
            e.stopImmediatePropagation();
            // Redo
            setCornersFuture((prev) => {
              const next = prev[0];
              const current = wallCornersRef.current;
              setCornersPast((past) => [...past, current]);
              setWallCorners(next);
              return prev.slice(1);
            });
          }
        }
      }
    };

    window.addEventListener("keydown", handleUndoRedo, true); // Use capture phase to intercept before WallEditor
    return () => window.removeEventListener("keydown", handleUndoRedo, true);
  }, []);

  // Zoom Handling - multiplicative, zoom toward cursor, unlimited
  useEffect(() => {
    let pinchInitialDist = 0;
    let pinchInitialZoom = 1;
    let pinchInitialMid = { x: 0, y: 0 };
    let pinchInitialPan = { x: 0, y: 0 };

    const clampZoom = (z: number) => Math.max(1e-6, Math.min(1e6, z));

    // Global wheel handler: when ctrlKey is pressed anywhere on the window, prevent browser zoom!
    const handleGlobalWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        // If the wheel event happened outside containerRef, we still zoom the canvas towards its center or cursor
        const container = containerRef.current;
        if (!container) return;
        const rect = container.getBoundingClientRect();
        
        let cursorX = e.clientX - rect.left;
        let cursorY = e.clientY - rect.top;

        // If cursor is outside container (e.g. over sidebar/toolbar), zoom towards container center instead
        if (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        ) {
          cursorX = rect.width / 2;
          cursorY = rect.height / 2;
        }

        // Multiplicative zoom
        const factor = Math.exp(-e.deltaY * 0.0015);
        const oldZoom = zoomRef.current;
        const newZoom = clampZoom(oldZoom * factor);

        // Zoom toward point: adjust pan so point stays fixed
        const newPanX = cursorX - (cursorX - panRef.current.x) * (newZoom / oldZoom);
        const newPanY = cursorY - (cursorY - panRef.current.y) * (newZoom / oldZoom);

        setZoom(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      }
    };

    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If ctrlKey is pressed, handleGlobalWheel already handled it and prevented default
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      e.preventDefault();
      const rect = container.getBoundingClientRect();
      const cursorX = e.clientX - rect.left;
      const cursorY = e.clientY - rect.top;

      // Multiplicative zoom
      const factor = Math.exp(-e.deltaY * 0.0015);
      const oldZoom = zoomRef.current;
      const newZoom = clampZoom(oldZoom * factor);

      // Zoom toward cursor: adjust pan so point under cursor stays fixed
      const newPanX = cursorX - (cursorX - panRef.current.x) * (newZoom / oldZoom);
      const newPanY = cursorY - (cursorY - panRef.current.y) * (newZoom / oldZoom);

      setZoom(newZoom);
      setPanOffset({ x: newPanX, y: newPanY });
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
          e.preventDefault();
          spaceDownRef.current = true;
        }
      }
      if (
        e.ctrlKey &&
        (e.key === "=" || e.key === "-" || e.key === "+" || e.key === "_")
      ) {
        e.preventDefault();
        const factor = e.key === "=" || e.key === "+" ? 1.15 : 1 / 1.15;
        const oldZoom = zoomRef.current;
        const newZoom = clampZoom(oldZoom * factor);
        // Zoom toward center of container
        const rect = container.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const newPanX = cx - (cx - panRef.current.x) * (newZoom / oldZoom);
        const newPanY = cy - (cy - panRef.current.y) * (newZoom / oldZoom);
        setZoom(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        spaceDownRef.current = false;
      }
    };

    // Pan: drag on background, middle mouse, space+drag
    const handlePointerDownPan = (e: PointerEvent) => {
      // Middle mouse button or space+left click or left click on empty background
      const isMiddle = e.button === 1;
      const isSpaceDrag = e.button === 0 && spaceDownRef.current;
      const isBackgroundDrag = e.button === 0 && !spaceDownRef.current && e.target === container;
      if (isMiddle || isSpaceDrag || isBackgroundDrag) {
        e.preventDefault();
        isPanningRef.current = true;
        panStartRef.current = { x: e.clientX, y: e.clientY };
        panStartOffsetRef.current = { ...panRef.current };
        container.setPointerCapture(e.pointerId);
      }
    };

    const handlePointerMovePan = (e: PointerEvent) => {
      if (!isPanningRef.current) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      setPanOffset({
        x: panStartOffsetRef.current.x + dx,
        y: panStartOffsetRef.current.y + dy,
      });
    };

    const handlePointerUpPan = (e: PointerEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        try { container.releasePointerCapture(e.pointerId); } catch {}
      }
    };

    // Touch pinch zoom
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY,
        );
        pinchInitialDist = dist;
        pinchInitialZoom = zoomRef.current;
        const rect = container.getBoundingClientRect();
        pinchInitialMid = {
          x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left,
          y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top,
        };
        pinchInitialPan = { ...panRef.current };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const dist = Math.hypot(
          e.touches[0].pageX - e.touches[1].pageX,
          e.touches[0].pageY - e.touches[1].pageY,
        );
        const newZoom = clampZoom(pinchInitialZoom * (dist / pinchInitialDist));
        // Zoom toward pinch midpoint
        const newPanX = pinchInitialMid.x - (pinchInitialMid.x - pinchInitialPan.x) * (newZoom / pinchInitialZoom);
        const newPanY = pinchInitialMid.y - (pinchInitialMid.y - pinchInitialPan.y) * (newZoom / pinchInitialZoom);
        setZoom(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
      }
    };

    window.addEventListener("wheel", handleGlobalWheel, { passive: false });
    container.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp);
    container.addEventListener("pointerdown", handlePointerDownPan);
    container.addEventListener("pointermove", handlePointerMovePan);
    container.addEventListener("pointerup", handlePointerUpPan);
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleGlobalWheel);
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      container.removeEventListener("pointerdown", handlePointerDownPan);
      container.removeEventListener("pointermove", handlePointerMovePan);
      container.removeEventListener("pointerup", handlePointerUpPan);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Center image on load and on container resize
  const centerImage = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const padding = 40;
    const cw = container.clientWidth - padding * 2;
    const ch = container.clientHeight - padding * 2;
    if (cw <= 0 || ch <= 0) return;
    const fitZoom = Math.min(cw / canvasDims.width, ch / canvasDims.height);
    const s = Math.max(1e-6, fitZoom);
    const panX = (container.clientWidth - canvasDims.width * s) / 2;
    const panY = (container.clientHeight - canvasDims.height * s) / 2;
    setZoom(s);
    setPanOffset({ x: panX, y: panY });
  }, [canvasDims]);

  // Center on first load when canvasDims change (image loaded)
  const hasInitialCentered = useRef(false);
  useEffect(() => {
    // Reset center flag when canvas dims change (new image loaded)
    hasInitialCentered.current = false;
  }, [canvasDims]);

  useEffect(() => {
    if (hasInitialCentered.current) return;
    if (!containerRef.current) return;
    // Wait a tick for layout to settle
    const timer = setTimeout(() => {
      centerImage();
      hasInitialCentered.current = true;
    }, 50);
    return () => clearTimeout(timer);
  }, [canvasDims, centerImage]);

  // ResizeObserver to recenter on container resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const ro = new ResizeObserver(() => {
      centerImage();
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [centerImage]);

  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setBgImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDownload = async () => {
    try {
      // === Canvas-based export to avoid html-to-image 3D transform clipping ===
      const isMobile = window.innerWidth <= 768;
      const pixelRatio = isMobile ? 1 : 2; // High resolution on desktop, lower on mobile for speed

      // Determine export bounds
      let minX = 0;
      let minY = 0;
      let maxX = canvasDims.width;
      let maxY = canvasDims.height;

      if (!bgImage) {
        minX = 3000;
        minY = 3000;
        maxX = 0;
        maxY = 0;

        includedWalls.forEach((wallId) => {
          const corners = wallCorners[wallId];
          if (corners) {
            corners.forEach((c) => {
              if (c.x < minX) minX = c.x;
              if (c.y < minY) minY = c.y;
              if (c.x > maxX) maxX = c.x;
              if (c.y > maxY) maxY = c.y;
            });
          }
        });

        if (maxX < minX) {
          minX = 0;
          minY = 0;
          maxX = 500;
          maxY = 500;
        } else {
          minX -= 50;
          minY -= 50;
          maxX += 50;
          maxY += 50;
        }

        // Clamp to valid range
        minX = Math.max(0, minX);
        minY = Math.max(0, minY);
      }

      const exportWidth = maxX - minX;
      const exportHeight = maxY - minY;

      // Create export canvas
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = exportWidth * pixelRatio;
      exportCanvas.height = exportHeight * pixelRatio;
      const ctx = exportCanvas.getContext("2d")!;
      ctx.scale(pixelRatio, pixelRatio);

      // 1. Draw background image
      if (bgImage) {
        const bgImg = new window.Image();
        bgImg.crossOrigin = "anonymous";
        bgImg.src = bgImage;
        await new Promise<void>((resolve) => {
          bgImg.onload = () => {
            ctx.drawImage(
              bgImg,
              -minX,
              -minY,
              canvasDims.width,
              canvasDims.height,
            );
            resolve();
          };
          bgImg.onerror = () => resolve();
        });
      } else {
        // Draw dotted pattern background
        ctx.fillStyle = "#e5e5f7";
        ctx.fillRect(0, 0, exportWidth, exportHeight);
        ctx.fillStyle = "#444cf7";
        for (let py = 0; py < canvasDims.height; py += 10) {
          for (let px = 0; px < canvasDims.width; px += 10) {
            const drawX = px - minX;
            const drawY = py - minY;
            if (
              drawX >= -1 &&
              drawX <= exportWidth + 1 &&
              drawY >= -1 &&
              drawY <= exportHeight + 1
            ) {
              ctx.beginPath();
              ctx.arc(drawX, drawY, 0.5, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }

      // 2. For each wall, extract the Konva canvas and warp it using perspective triangulation
      for (const wallId of includedWalls) {
        const dims = boxDimensions[wallId];
        const corners = wallCorners[wallId];
        if (!dims || !corners || corners.length !== 4) continue;

        // Find the Konva canvas element for this wall
        // Each WallEditor renders a Konva Stage which creates a canvas
        const wallWrappers = document.querySelectorAll(
          `[data-wall-id="${wallId}"]`,
        );
        let sourceCanvas: HTMLCanvasElement | null = null;

        if (wallWrappers.length > 0) {
          sourceCanvas = wallWrappers[0].querySelector(
            "canvas",
          ) as HTMLCanvasElement;
        }

        // Fallback: find canvas inside the transformed wall div
        if (!sourceCanvas) {
          const allTransformedDivs = document.querySelectorAll(
            "#mockup-canvas-inner .origin-top-left",
          );
          for (const div of Array.from(allTransformedDivs)) {
            const canvas = div.querySelector("canvas");
            if (canvas) {
              // Check if this canvas belongs to the current wall by checking parent's style
              const parentEl = canvas.closest(
                ".origin-top-left",
              ) as HTMLElement;
              if (parentEl && Math.abs(parentEl.offsetWidth - dims.width) < 5) {
                sourceCanvas = canvas;
                break;
              }
            }
          }
        }

        if (!sourceCanvas) continue;

        // Source dimensions: The Konva Stage renders into a canvas with
        // canvas.width = logicalWidth * pixelRatio. To get the correct logical
        // source coordinate space, we need to account for this.
        // The canvas CSS dimensions (set by Konva via style.width/height)
        // reflect the logical Stage size which may differ from dims.width/height
        // if the WallEditor container size doesn't match exactly.
        //
        // Use the canvas's CSS dimensions as the definitive source coordinate space,
        // since that's what the Stage actually rendered into.
        const canvasCSSWidth =
          parseFloat(sourceCanvas.style.width) ||
          sourceCanvas.offsetWidth ||
          dims.width;
        const canvasCSSHeight =
          parseFloat(sourceCanvas.style.height) ||
          sourceCanvas.offsetHeight ||
          dims.height;
        const srcW = canvasCSSWidth;
        const srcH = canvasCSSHeight;

        // Debug logging to diagnose size discrepancy
        console.log(`[Export Debug] Wall ${wallId}:`, {
          "dims.width": dims.width,
          "dims.height": dims.height,
          "canvas.width (pixels)": sourceCanvas.width,
          "canvas.height (pixels)": sourceCanvas.height,
          "canvas.style.width": sourceCanvas.style.width,
          "canvas.style.height": sourceCanvas.style.height,
          "canvas.offsetWidth": sourceCanvas.offsetWidth,
          "canvas.offsetHeight": sourceCanvas.offsetHeight,
          "srcW used": srcW,
          "srcH used": srcH,
        });

        // Destination corners (perspective-warped positions), shifted by export offset
        const dst = corners.map((c) => ({ x: c.x - minX, y: c.y - minY }));

        // Draw the warped wall using triangle-based affine subdivision
        drawTexturedQuad(ctx, sourceCanvas, srcW, srcH, dst);
      }

      // Convert to PNG/JPEG and download using Blob to avoid base64 URL length limits
      const mimeType = isMobile ? "image/jpeg" : "image/png";
      const quality = isMobile ? 0.7 : undefined;

      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            alert("Failed to generate image.");
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = blobUrl;
          link.download = `mockup-scene.${isMobile ? "jpg" : "png"}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // Clean up the object URL to free memory
          setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
        },
        mimeType,
        quality,
      );
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to download mockup.");
    }
  };

  // Helper: Draw a textured quad with perspective using triangle subdivision
  function drawTexturedQuad(
    ctx: CanvasRenderingContext2D,
    sourceCanvas: HTMLCanvasElement,
    srcW: number,
    srcH: number,
    dst: { x: number; y: number }[],
  ) {
    // Subdivide the quad into a grid and draw each cell as two triangles
    // More subdivisions = better perspective approximation
    const divisions = 20;

    const src = [
      { x: 0, y: 0 },
      { x: srcW, y: 0 },
      { x: srcW, y: srcH },
      { x: 0, y: srcH },
    ];

    const hParams = getHomographyParams(src, dst);

    for (let row = 0; row < divisions; row++) {
      for (let col = 0; col < divisions; col++) {
        // Source coordinates
        const sx0 = (col / divisions) * srcW;
        const sx1 = ((col + 1) / divisions) * srcW;
        const sy0 = (row / divisions) * srcH;
        const sy1 = ((row + 1) / divisions) * srcH;

        // Project points using true perspective (homography)
        // Fallback to bilinear if homography fails (collinear points etc)
        const p00 = hParams
          ? applyHomography(sx0, sy0, hParams)
          : bilinearInterp(dst, col / divisions, row / divisions);
        const p10 = hParams
          ? applyHomography(sx1, sy0, hParams)
          : bilinearInterp(dst, (col + 1) / divisions, row / divisions);
        const p01 = hParams
          ? applyHomography(sx0, sy1, hParams)
          : bilinearInterp(dst, col / divisions, (row + 1) / divisions);
        const p11 = hParams
          ? applyHomography(sx1, sy1, hParams)
          : bilinearInterp(dst, (col + 1) / divisions, (row + 1) / divisions);

        // Triangle 1: top-left
        drawTriangle(
          ctx,
          sourceCanvas,
          sx0,
          sy0,
          sx1,
          sy0,
          sx0,
          sy1,
          p00.x,
          p00.y,
          p10.x,
          p10.y,
          p01.x,
          p01.y,
          srcW,
          srcH,
        );

        // Triangle 2: bottom-right
        drawTriangle(
          ctx,
          sourceCanvas,
          sx1,
          sy0,
          sx1,
          sy1,
          sx0,
          sy1,
          p10.x,
          p10.y,
          p11.x,
          p11.y,
          p01.x,
          p01.y,
          srcW,
          srcH,
        );
      }
    }
  }

  function getHomographyParams(
    src: { x: number; y: number }[],
    dst: { x: number; y: number }[],
  ) {
    const A: number[][] = [];
    for (let i = 0; i < 4; i++) {
      const x = src[i].x;
      const y = src[i].y;
      const u = dst[i].x;
      const v = dst[i].y;
      A.push([x, y, 1, 0, 0, 0, -x * u, -y * u, u]);
      A.push([0, 0, 0, x, y, 1, -x * v, -y * v, v]);
    }

    for (let i = 0; i < 8; i++) {
      let maxEl = Math.abs(A[i][i]);
      let maxRow = i;
      for (let k = i + 1; k < 8; k++) {
        if (Math.abs(A[k][i]) > maxEl) {
          maxEl = Math.abs(A[k][i]);
          maxRow = k;
        }
      }

      const tmp = A[maxRow];
      A[maxRow] = A[i];
      A[i] = tmp;

      const pivot = A[i][i];
      if (pivot === 0) return null;

      for (let k = i; k < 9; k++) {
        A[i][k] /= pivot;
      }

      for (let j = 0; j < 8; j++) {
        if (i !== j) {
          const factor = A[j][i];
          for (let k = i; k < 9; k++) {
            A[j][k] -= factor * A[i][k];
          }
        }
      }
    }

    return {
      h11: A[0][8],
      h12: A[1][8],
      h13: A[2][8],
      h21: A[3][8],
      h22: A[4][8],
      h23: A[5][8],
      h31: A[6][8],
      h32: A[7][8],
    };
  }

  function applyHomography(x: number, y: number, h: any) {
    const w = h.h31 * x + h.h32 * y + 1;
    return {
      x: (h.h11 * x + h.h12 * y + h.h13) / w,
      y: (h.h21 * x + h.h22 * y + h.h23) / w,
    };
  }

  function bilinearInterp(
    corners: { x: number; y: number }[],
    u: number,
    v: number,
  ) {
    // corners: [topLeft, topRight, bottomRight, bottomLeft]
    const tl = corners[0];
    const tr = corners[1];
    const br = corners[2];
    const bl = corners[3];

    return {
      x:
        tl.x * (1 - u) * (1 - v) +
        tr.x * u * (1 - v) +
        br.x * u * v +
        bl.x * (1 - u) * v,
      y:
        tl.y * (1 - u) * (1 - v) +
        tr.y * u * (1 - v) +
        br.y * u * v +
        bl.y * (1 - u) * v,
    };
  }

  function drawTriangle(
    ctx: CanvasRenderingContext2D,
    img: HTMLCanvasElement,
    sx0: number,
    sy0: number,
    sx1: number,
    sy1: number,
    sx2: number,
    sy2: number,
    dx0: number,
    dy0: number,
    dx1: number,
    dy1: number,
    dx2: number,
    dy2: number,
    srcW: number,
    srcH: number,
  ) {
    ctx.save();

    // Clip to the destination triangle
    ctx.beginPath();
    ctx.moveTo(dx0, dy0);
    ctx.lineTo(dx1, dy1);
    ctx.lineTo(dx2, dy2);
    ctx.closePath();
    ctx.clip();

    // Calculate affine transform: source triangle -> destination triangle
    // [ a  c  e ] [ sx ]   [ dx ]
    // [ b  d  f ] [ sy ] = [ dy ]
    // [ 0  0  1 ] [ 1  ]   [ 1  ]
    const denom = sx0 * (sy1 - sy2) + sx1 * (sy2 - sy0) + sx2 * (sy0 - sy1);
    if (Math.abs(denom) < 0.001) {
      ctx.restore();
      return;
    }

    const a =
      (dx0 * (sy1 - sy2) + dx1 * (sy2 - sy0) + dx2 * (sy0 - sy1)) / denom;
    const b =
      (dy0 * (sy1 - sy2) + dy1 * (sy2 - sy0) + dy2 * (sy0 - sy1)) / denom;
    const c =
      (dx0 * (sx2 - sx1) + dx1 * (sx0 - sx2) + dx2 * (sx1 - sx0)) / denom;
    const d =
      (dy0 * (sx2 - sx1) + dy1 * (sx0 - sx2) + dy2 * (sx1 - sx0)) / denom;
    const e =
      (dx0 * (sx1 * sy2 - sx2 * sy1) +
        dx1 * (sx2 * sy0 - sx0 * sy2) +
        dx2 * (sx0 * sy1 - sx1 * sy0)) /
      denom;
    const f =
      (dy0 * (sx1 * sy2 - sx2 * sy1) +
        dy1 * (sx2 * sy0 - sx0 * sy2) +
        dy2 * (sx0 * sy1 - sx1 * sy0)) /
      denom;

    ctx.transform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0, srcW, srcH);
    ctx.restore();
  }

  const handleSaveMockup = async () => {
    if (!id) return;

    setIsUploading(true);
    try {
      const { data, error } = await supabase
        .from("projects")
        .select("data")
        .eq("id", id)
        .single();
      if (error || !data) throw new Error("Failed to load project data");

      const currentData = data.data;

      // Also grab the current custom colors to save them with the scene
      const { walls, products } = useCanvasStore.getState();
      const customColors: Record<string, string> = {};
      products.forEach((p) => {
        if (
          p.color &&
          (p.color.startsWith("http") ||
            p.color.startsWith("data:") ||
            p.color.startsWith("#"))
        ) {
          customColors[p.id] = p.color;
        }
      });

      // Save active mockup state into the list before saving
      let finalMockups = mockupsList.map((m) =>
        m.id === activeMockupId
          ? { ...m, bgImage, includedWalls, wallCorners }
          : m,
      );

      // Upload any local base64 images to Cloudinary before saving
      finalMockups = await Promise.all(
        finalMockups.map(async (m) => {
          if (m.bgImage && m.bgImage.startsWith("data:image")) {
            const res = await fetch("/api/upload-cloudinary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ file: m.bgImage }),
            });
            const data = await res.json();
            if (data.url) {
              return { ...m, bgImage: data.url };
            } else {
              throw new Error(data.error || "Failed to upload image to Cloudinary");
            }
          }
          return m;
        })
      );

      // Update state if the active mockup's bgImage was updated
      const activeMockupNow = finalMockups.find(m => m.id === activeMockupId);
      if (activeMockupNow && activeMockupNow.bgImage !== bgImage) {
        setBgImage(activeMockupNow.bgImage);
      }
      setMockupsList(finalMockups);

      currentData.mockupScenes = finalMockups;
      currentData.materialColors = customColors;

      const { error: saveError } = await supabase
        .from("projects")
        .update({ data: currentData })
        .eq("id", id);
      if (saveError) throw saveError;

      alert("Mockup saved successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to save mockup.");
    } finally {
      setIsUploading(false);
    }
  };

  const getTransformMatrix = (wallId: string) => {
    const dims = boxDimensions[wallId];
    const corners = wallCorners[wallId];
    if (!dims || !corners || corners.length !== 4) return "none";
    const src = [
      { x: 0, y: 0 },
      { x: dims.width, y: 0 },
      { x: dims.width, y: dims.height },
      { x: 0, y: dims.height },
    ];
    return solveHomography(src, corners);
  };

  // --- Mockup Manager Actions ---
  const handleAddMockup = () => {
    const newId = Date.now().toString();
    const newMockup = {
      id: newId,
      name: `Mockup ${mockupsList.length + 1}`,
      bgImage: null,
      includedWalls: [],
      wallCorners: {},
    };

    // Save current state first
    setMockupsList((prev) => [
      ...prev.map((m) =>
        m.id === activeMockupId
          ? { ...m, bgImage, includedWalls, wallCorners }
          : m,
      ),
      newMockup,
    ]);

    setActiveMockupId(newId);
    setBgImage(null);
    setIncludedWalls([]);
    setWallCorners({});
    setCornersPast([]);
    setCornersFuture([]);
  };

  const handleDuplicateMockup = (idToDup: string) => {
    const newId = Date.now().toString();
    // ensure current state is synced
    const syncedList = mockupsList.map((m) =>
      m.id === activeMockupId
        ? { ...m, bgImage, includedWalls, wallCorners }
        : m,
    );
    const source = syncedList.find((m) => m.id === idToDup);
    if (!source) return;

    const duplicated = { ...source, id: newId, name: `${source.name} (Copy)` };
    setMockupsList([...syncedList, duplicated]);

    setActiveMockupId(newId);
    setBgImage(duplicated.bgImage);
    setIncludedWalls([...duplicated.includedWalls]);
    setWallCorners(JSON.parse(JSON.stringify(duplicated.wallCorners)));
    setCornersPast([]);
    setCornersFuture([]);
  };

  const handleRemoveMockup = async (idToRemove: string) => {
    if (mockupsList.length <= 1) return;
    
    // Find the mockup to remove
    const mockupToRemove = mockupsList.find(m => m.id === idToRemove);
    
    const newList = mockupsList.filter((m) => m.id !== idToRemove);
    setMockupsList(newList);
    if (activeMockupId === idToRemove) {
      const next = newList[0];
      setActiveMockupId(next.id);
      setBgImage(next.bgImage);
      setIncludedWalls(next.includedWalls);
      setWallCorners(next.wallCorners);
      setCornersPast([]);
      setCornersFuture([]);
    }

    // Attempt to delete image from Cloudinary if it exists and is a Cloudinary URL
    if (mockupToRemove?.bgImage && mockupToRemove.bgImage.includes("cloudinary.com")) {
      try {
        await fetch("/api/delete-cloudinary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: mockupToRemove.bgImage }),
        });
      } catch (err) {
        console.error("Failed to delete mockup from Cloudinary", err);
      }
    }
  };

  const handleSetActiveMockup = (newId: string) => {
    if (newId === activeMockupId) return;
    // save current
    const syncedList = mockupsList.map((m) =>
      m.id === activeMockupId
        ? { ...m, bgImage, includedWalls, wallCorners }
        : m,
    );
    setMockupsList(syncedList);

    // load new
    const target = syncedList.find((m) => m.id === newId) || syncedList[0];
    setActiveMockupId(target.id);
    setBgImage(target.bgImage);
    setIncludedWalls(target.includedWalls);
    setWallCorners(target.wallCorners);
    setCornersPast([]);
    setCornersFuture([]);
  };

  const handleUpdateMockupName = (idToUpdate: string, newName: string) => {
    setMockupsList((prev) =>
      prev.map((m) => (m.id === idToUpdate ? { ...m, name: newName } : m)),
    );
  };

  if (loadingProject) {
    return (
      <div className="w-full h-[calc(100vh-60px)] md:h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#7B6DED] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 font-medium">
            Loading project mockup...
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden bg-slate-50">
      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative z-100">
        <div
          ref={containerRef}
          className="flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[#e5e5f7]"
          style={{ touchAction: "none", cursor: spaceDownRef.current ? "grab" : "default" }}
        >
          {/* Viewport transform wrapper - applies zoom and pan */}
          <div
            style={{
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
              willChange: "transform",
              position: "absolute",
              top: 0,
              left: 0,
            }}
          >
            <div
              id="mockup-canvas-inner"
              className="relative shrink-0"
              style={{
                width: `${canvasDims.width}px`,
                height: `${canvasDims.height}px`,
                transformStyle: "preserve-3d",
              }}
            >
              {/* Background Image Layer - Separated to prevent mobile 3D transform clipping bugs */}
              {bgImage ? (
                <img
                  src={bgImage}
                  alt="Background"
                  className="absolute top-0 left-0 pointer-events-none"
                  style={{
                    width: `${canvasDims.width}px`,
                    height: `${canvasDims.height}px`,
                    objectFit: "fill",
                  }}
                  crossOrigin="anonymous"
                />
              ) : (
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `radial-gradient(#444cf7 0.5px, #e5e5f7 0.5px)`,
                    backgroundSize: "10px 10px",
                    backgroundPosition: "top left",
                    backgroundRepeat: "no-repeat",
                  }}
                />
              )}
              {includedWalls.map((wallId) => {
                const dims = boxDimensions[wallId];
                const corners = wallCorners[wallId];
                if (!dims || !corners) return null;

                return (
                  <div key={wallId} data-wall-id={wallId}>
                    {/* Transformed Wall Wrapper */}
                    <div
                      className="absolute top-0 left-0 origin-top-left pointer-events-auto"
                      style={{
                        width: dims.width,
                        height: dims.height,
                        transform: getTransformMatrix(wallId) || "none",
                        zIndex: 10,
                        willChange: "transform",
                      }}
                    >
                      <div className="w-full h-full shadow-2xl opacity-90 overflow-visible bg-transparent pointer-events-auto">
                        <WallEditor
                          wallId={wallId}
                          overrideZoom={1}
                          overrideOffset={{ x: -dims.minX, y: -dims.minY }}
                          readOnly={true}
                          mockupCorners={wallCorners[wallId]}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {!bgImage && includedWalls.length === 0 && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                  <p className="text-gray-500 font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm">
                    Drag the corner points to perspective-warp the wall design.
                    <br />
                    Upload a background photo of a room for a realistic mockup!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Corner Handles Overlay - rendered in screen space, not clipped by overflow hidden */}
          <svg
            className="absolute inset-0 pointer-events-none"
            style={{ width: "100%", height: "100%", zIndex: 100, overflow: "visible" }}
          >
            {includedWalls.map((wallId) => {
              const corners = wallCorners[wallId];
              if (!corners || corners.length !== 4) return null;
              // Convert image coords to screen coords
              const screenCorners = corners.map((c) => ({
                x: c.x * zoom + panOffset.x,
                y: c.y * zoom + panOffset.y,
              }));
              return (
                <g key={`outline-${wallId}`}>
                  <polygon
                    points={screenCorners.map((c) => `${c.x},${c.y}`).join(" ")}
                    fill="none"
                    stroke="#7B6DED"
                    strokeWidth={1.5}
                    vectorEffect="non-scaling-stroke"
                    opacity={0.7}
                  />
                  {/* Lines between adjacent corners */}
                  {screenCorners.map((c, i) => {
                    const next = screenCorners[(i + 1) % 4];
                    return (
                      <line
                        key={`line-${wallId}-${i}`}
                        x1={c.x}
                        y1={c.y}
                        x2={next.x}
                        y2={next.y}
                        stroke="#7B6DED"
                        strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke"
                        opacity={0.5}
                      />
                    );
                  })}
                </g>
              );
            })}
          </svg>

          {/* Corner Handle Hit Areas - rendered in screen space as absolutely positioned divs */}
          {includedWalls.map((wallId) => {
            const corners = wallCorners[wallId];
            if (!corners) return null;
            return corners.map((corner, i) => {
              const screenX = corner.x * zoom + panOffset.x;
              const screenY = corner.y * zoom + panOffset.y;
              const handleKey = `${wallId}-${i}`;
              const isActive = draggingHandle?.wallId === wallId && draggingHandle?.index === i;
              const isTop = topHandleKey === handleKey;
              return (
                <div
                  key={`${wallId}-corner-${i}`}
                  onPointerDown={(e) => handlePointerDown(wallId, i, e)}
                  className="absolute cursor-move touch-none"
                  style={{
                    left: screenX - 16,
                    top: screenY - 16,
                    width: 32,
                    height: 32,
                    zIndex: isActive ? 210 : isTop ? 200 : 150 + includedWalls.indexOf(wallId) * 10,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div
                    className="rounded-full bg-white border-[3px] border-[#7B6DED] shadow-md transition-transform"
                    style={{
                      width: 14,
                      height: 14,
                      transform: isActive ? "scale(1.2)" : "scale(1)",
                    }}
                  />
                </div>
              );
            });
          })}
        </div>

        {/* Right Sidebar: Toolbar */}
        <div className="w-full md:w-[320px] h-[45vh] md:h-full flex flex-col flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 shadow-sm z-10 bg-white">
          <div className="flex justify-end p-4 gap-2">
            <button
              onClick={() => router.push("/projects")}
              title="Proyek"
              className="text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50 transition active:scale-95"
            >
              <Folder size={16} />
            </button>
            <button
              onClick={handleSaveMockup}
              title="Save Mockup"
              className="text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50 transition active:scale-95"
            >
              <Save size={16} />
            </button>
            <button
              onClick={handleDownload}
              title="Download Mockup"
              className="text-sm font-medium text-white cursor-pointer bg-[#7B6DED] w-9 h-9 rounded-lg flex items-center justify-center hover:bg-[#6A5ED4] transition shadow-sm active:scale-95"
            >
              <Download size={16} />
            </button>
            <label
              title="Upload Background"
              className={`text-sm font-medium text-gray-600 cursor-pointer bg-gray-100 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-200 transition ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
            >
              <ImageIcon
                size={16}
                className={isUploading ? "animate-pulse" : ""}
              />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={isUploading}
              />
            </label>
            <button
              onClick={() => router.back()}
              className="text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 w-9 h-9 rounded-lg flex items-center justify-center hover:bg-gray-50 transition active:scale-95"
              title="Kembali"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
          <div className="flex justify-end p-4 gap-2">
            <div className="relative" ref={wallDropdownRef}>
              <button
                title="Select Walls"
                onClick={() => setWallDropdownOpen((prev) => !prev)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#7B6DED] focus:border-[#7B6DED] flex items-center justify-center p-2 outline-none min-w-[2.25rem] md:min-w-[120px] md:justify-between"
              >
                <span className="flex items-center">
                  <svg
                    className="w-4 h-4 md:mr-2 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                  <span className="hidden md:inline">
                    {includedWalls.length} selected
                  </span>
                  <span className="md:hidden ml-1 font-semibold">
                    {includedWalls.length}
                  </span>
                </span>
                <svg
                  className={`w-4 h-4 ml-2 shrink-0 transition-transform ${wallDropdownOpen ? "rotate-180" : ""}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M19 9l-7 7-7-7"
                  ></path>
                </svg>
              </button>
              {wallDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-[250]">
                  <ul className="py-1">
                    {walls.map((wall) => (
                      <li
                        key={wall.id}
                        className="px-4 py-2 hover:bg-gray-100 active:bg-gray-200 flex items-center cursor-pointer"
                        onClick={() => {
                          setIncludedWalls((prev) =>
                            prev.includes(wall.id)
                              ? prev.filter((id) => id !== wall.id)
                              : [...prev, wall.id],
                          );
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={includedWalls.includes(wall.id)}
                          readOnly
                          className="mr-2 rounded text-[#7B6DED] focus:ring-[#7B6DED]"
                        />
                        <span className="text-sm text-gray-700">
                          {wall.name}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Per-Trap Drop/Up Toggle */}
          {hasCeiling && ceilingTraps.length > 0 && (
            <div className="p-4 border-b border-gray-100 bg-gray-50/50 space-y-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-widest">
                Ceiling Type
              </span>
              {ceilingTraps.map((trap, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Trap {idx + 1}</span>
                  <div className="flex items-center bg-gray-200 rounded-lg p-0.5">
                    <button
                      onClick={() => {
                        const newTraps = [...ceilingTraps];
                        newTraps[idx] = { ...newTraps[idx], isUpCeiling: true };
                        setCeilingTraps(ceilingWall!.id, newTraps);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        trap.isUpCeiling
                          ? "bg-white shadow-sm text-[#7B6DED]"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Up
                    </button>
                    <button
                      onClick={() => {
                        const newTraps = [...ceilingTraps];
                        newTraps[idx] = {
                          ...newTraps[idx],
                          isUpCeiling: false,
                        };
                        setCeilingTraps(ceilingWall!.id, newTraps);
                      }}
                      className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                        !trap.isUpCeiling
                          ? "bg-white shadow-sm text-gray-900"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Drop
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0">
            <TextureSelector
              mockupsList={mockupsList}
              activeMockupId={activeMockupId}
              handleAddMockup={handleAddMockup}
              handleRemoveMockup={handleRemoveMockup}
              handleSetActiveMockup={handleSetActiveMockup}
              handleUpdateMockupName={handleUpdateMockupName}
              handleDuplicateMockup={handleDuplicateMockup}
            />
          </div>
        </div>
      </div>
    </main>
  );
}

export default function MockupPage() {
  return (
    <ProtectedRoute>
      <Suspense
        fallback={
          <div className="w-full h-screen flex items-center justify-center bg-slate-50">
            Loading project...
          </div>
        }
      >
        <MockupPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
