"use client";

import { useEffect, useRef, Suspense, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams, useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";
import html2canvas from "html2canvas";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading Mockup...</div>
    </div>
  ),
});

// Helper for solving homography
function solveHomography(src: {x: number, y: number}[], dst: {x: number, y: number}[]) {
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
        A[0][8], A[3][8], 0, A[6][8],
        A[1][8], A[4][8], 0, A[7][8],
        0,       0,       1, 0,
        A[2][8], A[5][8], 0, 1
    ];
    
    return `matrix3d(${H.join(',')})`;
}

function MockupPageContent() {
  const wallEditorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  
  const { loadProject, fetchProducts, walls, activeWallId, setActiveWall, setIsColoringPreview } = useCanvasStore();
  const [loadingProject, setLoadingProject] = useState(!!id);

  // Background Image State
  const [bgImage, setBgImage] = useState<string | null>(null);

  const activeWall = useMemo(() => walls.find(w => w.id === activeWallId) || walls[0], [walls, activeWallId]);
  
  // Dynamic box size based on wall bounds
  const [boxDimensions, setBoxDimensions] = useState({ width: 800, height: 600 });

  // Draggable corners (TL, TR, BR, BL)
  const [corners, setCorners] = useState([
      { x: 100, y: 100 },
      { x: 700, y: 100 },
      { x: 700, y: 500 },
      { x: 100, y: 500 }
  ]);

  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);

  // Adjust exact bounds when active wall changes
  useEffect(() => {
      if (activeWall && activeWall.points.length >= 3) {
          const xs = activeWall.points.map(p => p.x);
          const ys = activeWall.points.map(p => p.y);
          const minX = Math.min(...xs);
          const minY = Math.min(...ys);
          const maxX = Math.max(...xs);
          const maxY = Math.max(...ys);
          
          const w = Math.max(10, maxX - minX);
          const h = Math.max(10, maxY - minY);

          setBoxDimensions({ width: w, height: h });
          
          // Force Canvas to show exact bounds without margins
          useCanvasStore.getState().setZoom(1);
          useCanvasStore.getState().setOffset(-minX, -minY);
          
          // Place the initial corners nicely in the center of screen
          const scale = Math.min(800 / w, 500 / h, 1);
          const displayW = w * scale;
          const displayH = h * scale;
          
          const startX = Math.max(50, (window.innerWidth - displayW) / 2);
          const startY = 100;

          setCorners([
              { x: startX, y: startY },
              { x: startX + displayW, y: startY },
              { x: startX + displayW, y: startY + displayH },
              { x: startX, y: startY + displayH }
          ]);
      }
  }, [activeWallId, activeWall]);

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
        }
        setLoadingProject(false);
      }
    }
    init();

    // Enable coloring preview mode for the Mockup to hide labels and sizes
    setIsColoringPreview(true);
    return () => setIsColoringPreview(false);
  }, [id, loadProject, fetchProducts, setIsColoringPreview]);

  // Handle Dragging
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (draggingIdx === null || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          setCorners(prev => {
              const newCorners = [...prev];
              newCorners[draggingIdx] = { x, y };
              return newCorners;
          });
      };

      const handleMouseUp = () => {
          setDraggingIdx(null);
      };

      if (draggingIdx !== null) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [draggingIdx]);

  const [isUploading, setIsUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setIsUploading(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              
              try {
                  const res = await fetch('/api/upload-cloudinary', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ file: base64 })
                  });
                  
                  const data = await res.json();
                  if (data.url) {
                      setBgImage(data.url);
                  } else {
                      console.error("Cloudinary upload failed:", data.error);
                      alert("Upload failed: " + data.error);
                  }
              } catch (err) {
                  console.error(err);
                  alert("Upload failed due to network error.");
              } finally {
                  setIsUploading(false);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleDownload = async () => {
      if (!containerRef.current) return;
      
      try {
          // Hide corner handles for the screenshot
          const handles = containerRef.current.querySelectorAll('.cursor-move');
          handles.forEach((h: any) => h.style.display = 'none');
          
          const canvas = await html2canvas(containerRef.current, {
              useCORS: true,
              allowTaint: true,
              backgroundColor: null,
          });
          
          // Restore handles
          handles.forEach((h: any) => h.style.display = '');

          const url = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = url;
          link.download = `mockup-${activeWall?.name || 'wall'}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (err) {
          console.error("Download failed:", err);
          alert("Failed to download mockup.");
      }
  };

  const transformMatrix = useMemo(() => {
      // Source corners are the literal pixel corners of the WallEditor container
      const src = [
          { x: 0, y: 0 },
          { x: boxDimensions.width, y: 0 },
          { x: boxDimensions.width, y: boxDimensions.height },
          { x: 0, y: boxDimensions.height }
      ];
      return solveHomography(src, corners);
  }, [corners, boxDimensions]);

  if (loadingProject) {
    return (
      <div className="w-full h-[calc(100vh-60px)] md:h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-[#7B6DED] border-t-transparent rounded-full animate-spin"></div>
          <div className="text-gray-500 font-medium">Loading project mockup...</div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex flex-col h-[calc(100vh-60px)] md:h-screen overflow-hidden bg-slate-50">
      {/* Top Header & Dropdown */}
      <div className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
            <button 
                onClick={() => router.push('/projects')}
                className="p-2 hover:bg-gray-100 rounded-full transition"
            >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <h1 className="text-lg font-medium text-gray-800">Perspective Mockup</h1>
        </div>
        <div className="flex items-center gap-4">
            <button 
                onClick={handleDownload}
                className="text-sm font-medium text-white cursor-pointer bg-[#7B6DED] px-4 py-1.5 rounded hover:bg-[#6A5ED4] transition shadow-sm active:scale-95"
            >
                Download Mockup
            </button>
            <label className={`text-sm font-medium text-gray-600 cursor-pointer bg-gray-100 px-3 py-1.5 rounded hover:bg-gray-200 transition ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}>
                {isUploading ? 'Uploading...' : 'Upload Background'}
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
            </label>
            <div className="h-6 w-px bg-gray-300"></div>
            <label className="text-sm font-medium text-gray-600">Select Wall:</label>
            <select 
                value={activeWallId || ''} 
                onChange={(e) => setActiveWall(e.target.value)}
                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#7B6DED] focus:border-[#7B6DED] block p-2.5 outline-none min-w-[150px]"
            >
                {walls.map((wall) => (
                    <option key={wall.id} value={wall.id}>
                        {wall.name}
                    </option>
                ))}
            </select>
        </div>
      </div>

      {/* Main Mockup Area */}
      <div 
        ref={containerRef}
        className="flex-1 min-h-0 relative overflow-hidden bg-[#e5e5f7]"
        style={{
            backgroundImage: bgImage ? `url(${bgImage})` : `radial-gradient(#444cf7 0.5px, #e5e5f7 0.5px)`,
            backgroundSize: bgImage ? 'contain' : '10px 10px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}
      >
          {/* Transformed Wall Wrapper */}
          <div 
            className="absolute top-0 left-0 origin-top-left pointer-events-none"
            style={{ 
                width: boxDimensions.width, 
                height: boxDimensions.height,
                transform: transformMatrix || 'none'
            }}
          >
              <div className="w-full h-full pointer-events-auto shadow-2xl opacity-90 overflow-hidden bg-transparent">
                  <WallEditor ref={wallEditorRef} />
              </div>
          </div>

          {/* Draggable Corner Handles */}
          {corners.map((corner, i) => (
              <div
                  key={i}
                  onMouseDown={(e) => {
                      e.stopPropagation();
                      setDraggingIdx(i);
                  }}
                  className="absolute w-6 h-6 bg-white border-[3px] border-[#7B6DED] rounded-full shadow-md cursor-move -ml-3 -mt-3 z-50 hover:scale-110 active:scale-95 transition-transform"
                  style={{ left: corner.x, top: corner.y }}
              />
          ))}
          
          {!bgImage && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                  <p className="text-gray-500 font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm">
                      Drag the corner points to perspective-warp the wall design.<br/>
                      Upload a background photo of a room for a realistic mockup!
                  </p>
              </div>
          )}
      </div>
    </main>
  );
}

export default function MockupPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-slate-50">Loading project...</div>}>
        <MockupPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}
