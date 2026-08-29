"use client";
import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Toolbar from "../components/Toolbar";
import ColoringToolbar from "../components/ColoringToolbar";
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
  const [activeTab, setActiveTab] = useState<"editor" | "coloring">("editor");

  return (
    <main className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      <div className="flex-1 min-h-0 relative">
        <WallEditor
          ref={wallEditorRef}
          forceColoringMode={activeTab === "coloring"}
        />
      </div>
      <div className="h-[60vh] md:h-full border-t md:border-t-0 md:border-l border-[#E5E5E5] flex flex-col w-full md:w-[35%]">
        <div className="flex bg-white border-b border-gray-200 shrink-0">
          <button
            className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === "editor" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            onClick={() => setActiveTab("editor")}
          >
            Design Editor
          </button>
          <button
            className={`flex-1 py-3 text-xs font-bold transition-colors ${activeTab === "coloring" ? "text-indigo-600 border-b-2 border-indigo-600" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}
            onClick={() => setActiveTab("coloring")}
          >
            Material & Warna
          </button>
        </div>
        <div className="flex-1 overflow-hidden relative">
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden ${activeTab === "editor" ? "block" : "hidden"}`}
          >
            <Toolbar wallEditorRef={wallEditorRef} />
          </div>
          <div
            className={`absolute inset-0 overflow-y-auto overflow-x-hidden ${activeTab === "coloring" ? "block" : "hidden"}`}
          >
            <ColoringToolbar wallEditorRef={wallEditorRef} />
          </div>
        </div>
      </div>
    </main>
  );
}
