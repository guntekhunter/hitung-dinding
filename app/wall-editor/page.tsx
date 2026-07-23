"use client";
import { useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Toolbar from "../components/Toolbar";
import { useCanvasStore } from "../store/useCanvasStore";

const WallEditor = dynamic(() => import("../components/WallEditor"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-[#fdfbf7] flex items-center justify-center">
      <div className="animate-pulse text-slate-400">Loading Editor...</div>
    </div>
  ),
});

export default function WallEditorPage() {
  const wallEditorRef = useRef<any>(null);

  // console.log the canvas conva code
  // const walls = useCanvasStore((state) => state.walls);
  // console.log("Canvas Design:", walls);

  return (
    <main className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      <div className="flex-1 min-h-0 relative">
        <WallEditor ref={wallEditorRef} />
      </div>
      <div className="h-[60vh] md:h-full border-t md:border-t-0 md:border-l border-[#E5E5E5]">
        <Toolbar wallEditorRef={wallEditorRef} />
      </div>
    </main>
  );
}
