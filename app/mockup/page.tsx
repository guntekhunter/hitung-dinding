"use client";

import { useEffect, useRef, Suspense, useState } from "react";
import dynamic from "next/dynamic";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams, useRouter } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading Mockup...</div>
    </div>
  ),
});

function MockupPageContent() {
  const wallEditorRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  
  const { loadProject, fetchProducts, walls, activeWallId, setActiveWall } = useCanvasStore();
  const [loadingProject, setLoadingProject] = useState(!!id);

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
  }, [id, loadProject, fetchProducts]);

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
            <h1 className="text-lg font-medium text-gray-800">Mockup View</h1>
        </div>
        <div className="flex items-center gap-3">
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
      <div className="flex-1 min-h-0 relative pointer-events-none">
          {/* We use pointer-events-none here to make it a pure view-only mockup. Or we can just let WallEditor handle its own read-only state. Since WallEditor allows dragging and editing, if we want a pure static mockup we could wrap it. For now, letting it render as is, but you can interact with it unless we add a specific read-only prop. */}
          <div className="w-full h-full pointer-events-auto">
            <WallEditor ref={wallEditorRef} />
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
