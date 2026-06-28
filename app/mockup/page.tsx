"use client";

import { useEffect, useRef, Suspense, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams, useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";
import * as htmlToImage from "html-to-image";
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

  // Scene state
  const [includedWalls, setIncludedWalls] = useState<string[]>([]);
  const [wallCorners, setWallCorners] = useState<Record<string, {x: number, y: number}[]>>({});
  
  // Keep track of dynamic box sizes for each included wall
  const [boxDimensions, setBoxDimensions] = useState<Record<string, {width: number, height: number, minX: number, minY: number}>>({});

  const [draggingHandle, setDraggingHandle] = useState<{wallId: string, index: number} | null>(null);

  // Initialize/Update bounds when included walls change
  useEffect(() => {
      const newDims = { ...boxDimensions };
      let updatedCorners = { ...wallCorners };
      let changed = false;

      includedWalls.forEach(wallId => {
          const wData = walls.find(w => w.id === wallId);
          if (wData && wData.points.length >= 3 && !newDims[wallId]) {
              const xs = wData.points.map(p => p.x);
              const ys = wData.points.map(p => p.y);
              const minX = Math.min(...xs);
              const minY = Math.min(...ys);
              const maxX = Math.max(...xs);
              const maxY = Math.max(...ys);
              
              const w = Math.max(10, maxX - minX);
              const h = Math.max(10, maxY - minY);
              
              newDims[wallId] = { width: w, height: h, minX, minY };
              
              if (!updatedCorners[wallId]) {
                  const scale = Math.min(800 / w, 500 / h, 1);
                  const displayW = w * scale;
                  const displayH = h * scale;
                  
                  // offset slightly based on how many walls are included to avoid full overlap
                  const offset = Object.keys(updatedCorners).length * 40;
                  const startX = Math.max(50, (window.innerWidth - displayW) / 2) + offset;
                  const startY = 100 + offset;

                  updatedCorners[wallId] = [
                      { x: startX, y: startY },
                      { x: startX + displayW, y: startY },
                      { x: startX + displayW, y: startY + displayH },
                      { x: startX, y: startY + displayH }
                  ];
              }
              changed = true;
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
            if (data.data.mockupScene) {
                setBgImage(data.data.mockupScene.bgImage || null);
                setIncludedWalls(data.data.mockupScene.includedWalls || []);
                setWallCorners(data.data.mockupScene.wallCorners || {});
            } else if (data.data.mockups) {
                // legacy migration
                const firstId = Object.keys(data.data.mockups)[0];
                if (firstId) {
                    setBgImage(data.data.mockups[firstId].bgImage);
                    setIncludedWalls([firstId]);
                    setWallCorners({ [firstId]: data.data.mockups[firstId].corners });
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

  // Handle Dragging
  useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
          if (!draggingHandle || !containerRef.current) return;
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          
          setWallCorners(prev => {
              const newCorners = { ...prev };
              if (newCorners[draggingHandle.wallId]) {
                  const arr = [...newCorners[draggingHandle.wallId]];
                  arr[draggingHandle.index] = { x, y };
                  newCorners[draggingHandle.wallId] = arr;
              }
              return newCorners;
          });
      };

      const handleMouseUp = () => {
          setDraggingHandle(null);
      };

      if (draggingHandle) {
          window.addEventListener('mousemove', handleMouseMove);
          window.addEventListener('mouseup', handleMouseUp);
      }

      return () => {
          window.removeEventListener('mousemove', handleMouseMove);
          window.removeEventListener('mouseup', handleMouseUp);
      };
  }, [draggingHandle]);

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
          
          const url = await htmlToImage.toPng(containerRef.current, {
              cacheBust: true,
              backgroundColor: '#e5e5f7' // ensure background matches
          });
          
          // Restore handles
          handles.forEach((h: any) => h.style.display = '');

          const link = document.createElement("a");
          link.href = url;
          link.download = `mockup-scene.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      } catch (err) {
          console.error("Download failed:", err);
          alert("Failed to download mockup.");
      }
  };

  const handleSaveMockup = async () => {
      if (!id) return;
      
      try {
          const { data, error } = await supabase.from("projects").select("data").eq("id", id).single();
          if (error || !data) throw new Error("Failed to load project data");
          
          const currentData = data.data;
          currentData.mockupScene = { bgImage, includedWalls, wallCorners };

          const { error: saveError } = await supabase.from("projects").update({ data: currentData }).eq("id", id);
          if (saveError) throw saveError;
          
          alert("Mockup saved successfully!");
      } catch (err) {
          console.error(err);
          alert("Failed to save mockup.");
      }
  };

  const getTransformMatrix = (wallId: string) => {
      const dims = boxDimensions[wallId];
      const corners = wallCorners[wallId];
      if (!dims || !corners || corners.length !== 4) return 'none';
      const src = [
          { x: 0, y: 0 },
          { x: dims.width, y: 0 },
          { x: dims.width, y: dims.height },
          { x: 0, y: dims.height }
      ];
      return solveHomography(src, corners);
  };

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
        <div className="flex items-center gap-3">
            <button 
                onClick={handleSaveMockup}
                className="text-sm font-medium text-gray-700 cursor-pointer bg-white border border-gray-300 px-4 py-1.5 rounded hover:bg-gray-50 transition shadow-sm active:scale-95"
            >
                Save Mockup
            </button>
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
            <label className="text-sm font-medium text-gray-600">Select Walls to Include:</label>
            <div className="relative group">
                <button className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-[#7B6DED] focus:border-[#7B6DED] block p-2.5 outline-none min-w-[150px] text-left flex justify-between items-center">
                    {includedWalls.length} wall(s) selected
                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                </button>
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg hidden group-hover:block z-50">
                    <ul className="py-1">
                        {walls.map((wall) => (
                            <li key={wall.id} className="px-4 py-2 hover:bg-gray-100 flex items-center cursor-pointer" onClick={() => {
                                setIncludedWalls(prev => prev.includes(wall.id) ? prev.filter(id => id !== wall.id) : [...prev, wall.id]);
                            }}>
                                <input type="checkbox" checked={includedWalls.includes(wall.id)} readOnly className="mr-2 rounded text-[#7B6DED] focus:ring-[#7B6DED]" />
                                <span className="text-sm text-gray-700">{wall.name}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0 relative">
        {/* Main Mockup Area */}
        <div 
          ref={containerRef}
          className="flex-1 min-h-0 min-w-0 relative overflow-hidden bg-[#e5e5f7]"
          style={{
            backgroundImage: bgImage ? `url(${bgImage})` : `radial-gradient(#444cf7 0.5px, #e5e5f7 0.5px)`,
            backgroundSize: bgImage ? 'contain' : '10px 10px',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
        }}
      >
          {includedWalls.map(wallId => {
              const dims = boxDimensions[wallId];
              const corners = wallCorners[wallId];
              if (!dims || !corners) return null;

              return (
                  <div key={wallId}>
                      {/* Transformed Wall Wrapper */}
                      <div 
                        className="absolute top-0 left-0 origin-top-left pointer-events-none"
                        style={{ 
                            width: dims.width, 
                            height: dims.height,
                            transform: getTransformMatrix(wallId) || 'none',
                            zIndex: 10
                        }}
                      >
                          <div className="w-full h-full shadow-2xl opacity-90 overflow-hidden bg-transparent pointer-events-none">
                              <WallEditor 
                                  wallId={wallId} 
                                  overrideZoom={1} 
                                  overrideOffset={{ x: -dims.minX, y: -dims.minY }} 
                              />
                          </div>
                      </div>

                      {/* Draggable Corner Handles */}
                      {corners.map((corner, i) => (
                          <div
                              key={`${wallId}-corner-${i}`}
                              onMouseDown={(e) => {
                                  e.stopPropagation();
                                  setDraggingHandle({ wallId, index: i });
                              }}
                              className="absolute w-6 h-6 bg-white border-[3px] border-[#7B6DED] rounded-full shadow-md cursor-move -ml-3 -mt-3 hover:scale-110 active:scale-95 transition-transform"
                              style={{ left: corner.x, top: corner.y, zIndex: 50 + (includedWalls.indexOf(wallId) * 10) }}
                          />
                      ))}
                  </div>
              );
          })}
          
          {!bgImage && includedWalls.length === 0 && (
              <div className="absolute top-8 left-1/2 -translate-x-1/2 text-center pointer-events-none">
                  <p className="text-gray-500 font-medium bg-white/80 px-4 py-2 rounded-full shadow-sm">
                      Drag the corner points to perspective-warp the wall design.<br/>
                      Upload a background photo of a room for a realistic mockup!
                  </p>
              </div>
          )}
        </div>
        
        {/* Right Sidebar: Texture Selector */}
        <div className="w-full md:w-[320px] h-[30vh] md:h-full flex-shrink-0 border-l border-gray-200 shadow-sm z-10">
            <TextureSelector />
        </div>
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
