"use client";

import { useEffect, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import ColoringToolbar from "../components/ColoringToolbar";
import ProtectedRoute from "../components/ProtectedRoute";
import { useSearchParams } from "next/navigation";
import { useCanvasStore } from "../store/useCanvasStore";
import { supabase } from "../../lib/supabase";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading Editor...</div>
    </div>
  ),
});

function ColoringPageContent() {
  const wallEditorRef = useRef<any>(null);
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { loadProject, fetchProducts } = useCanvasStore();

  useEffect(() => {
    async function init() {
      await fetchProducts(); // ensure products are loaded
      
      if (id) {
        const { data, error } = await supabase
            .from("projects")
            .select("data")
            .eq("id", id)
            .single();

        if (data && !error) {
            loadProject(id, data.data);
        }
      }
    }
    init();
  }, [id, loadProject, fetchProducts]);

  return (
    <main className="flex flex-col md:flex-row h-[calc(100vh-60px)] md:h-screen overflow-hidden bg-slate-50">
      <div className="flex-1 min-h-0 relative">
        <WallEditor ref={wallEditorRef} />
      </div>
      <div className="h-[30vh] md:h-full border-t md:border-t-0 md:border-l border-[#E5E5E5] flex-shrink-0">
        <ColoringToolbar wallEditorRef={wallEditorRef} />
      </div>
    </main>
  );
}

export default function ColoringPage() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="w-full h-screen flex items-center justify-center bg-slate-50">Loading project...</div>}>
        <ColoringPageContent />
      </Suspense>
    </ProtectedRoute>
  );
}