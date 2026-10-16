"use client";
import { useRef, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Toolbar from "../components/Toolbar";
import ColoringToolbar from "../components/ColoringToolbar";
import { useCanvasStore } from "../store/useCanvasStore";
import { Layers, Plus } from "lucide-react";

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

  const { walls, activeWallId, setActiveWall, addWall } = useCanvasStore();
  const currentActiveWall =
    walls.find((w) => w.id === activeWallId) || walls[0];
  const currentActiveId = currentActiveWall?.id || activeWallId;

  // Ensure activeWallId is valid
  useEffect(() => {
    if (!activeWallId && currentActiveWall) {
      setActiveWall(currentActiveWall.id);
    }
  }, [activeWallId, currentActiveWall, setActiveWall]);

  return (
    <main className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
      <div className="flex-1 min-h-0 relative">
        {/* Active Wall Indicator & Switcher */}
        <div className="absolute top-3 left-3 right-3 md:right-auto z-20 pointer-events-auto">
          <div className="bg-white/95 backdrop-blur-md border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow rounded-xl p-1.5 flex items-center gap-1.5 max-w-full overflow-x-auto scrollbar-none">
            {/* Header label */}
            <div className="flex items-center gap-1.5 px-2 py-1 text-slate-500 shrink-0">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 hidden sm:inline">
                Dinding Aktif:
              </span>
            </div>

            <div className="h-4 w-px bg-slate-200 shrink-0 hidden sm:block" />

            {/* List of Wall Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
              {walls.map((wall) => {
                const isActive = wall.id === currentActiveId;
                const isCeiling = wall.type === "ceiling";
                return (
                  <button
                    key={wall.id}
                    onClick={() => setActiveWall(wall.id)}
                    className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all shrink-0 font-medium ${
                      isActive
                        ? "bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/20 font-semibold"
                        : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 hover:text-slate-900 border border-slate-200/60"
                    }`}
                    title={`Pilih ${wall.name}`}
                  >
                    {isActive ? (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    )}
                    <span className="truncate max-w-[120px]">
                      {wall.name || (isCeiling ? "Plafon" : "Dinding")}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                        isActive
                          ? "bg-indigo-700/80 text-indigo-100"
                          : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {isCeiling ? "Plafon" : "Dinding"}
                    </span>
                    {isActive && (
                      <span className="text-[9px] font-bold bg-white text-indigo-700 px-1 py-0.2 rounded ml-0.5">
                        Aktif
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Add Wall / Ceiling Buttons */}
            <div className="flex items-center gap-1 shrink-0 pl-1 border-l border-slate-200">
              <button
                onClick={() => addWall("wall")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all shrink-0"
                title="Tambah Dinding Baru"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden md:inline">Dinding</span>
              </button>
              <button
                onClick={() => addWall("ceiling")}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all shrink-0"
                title="Tambah Plafon Baru"
              >
                <Plus className="w-3 h-3" />
                <span className="hidden md:inline">Plafon</span>
              </button>
            </div>

            {/* Status of Active Wall */}
            {currentActiveWall && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 text-[11px] bg-slate-50 rounded-lg border border-slate-200/60 shrink-0 text-slate-500 ml-1">
                <span className="text-slate-400">Status:</span>
                <span
                  className={
                    currentActiveWall.isClosed
                      ? "font-semibold text-emerald-600"
                      : "font-medium text-amber-600"
                  }
                >
                  {currentActiveWall.isClosed ? "Tertutup" : "Draft"}
                </span>
              </div>
            )}
          </div>
        </div>

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
