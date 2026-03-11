"use client";
import { useRef } from "react";
import Toolbar from "./components/Toolbar";
import WallEditor from "./components/WallEditor";
import ProtectedRoute from "./components/ProtectedRoute";

export default function Home() {
  const wallEditorRef = useRef<any>(null);

  return (
    <ProtectedRoute>
      <main className="flex flex-col md:flex-row h-screen overflow-hidden bg-slate-50">
        <div className="flex-1 min-h-0 relative">
          <WallEditor ref={wallEditorRef} />
        </div>
        <div className="h-[40vh] md:h-full border-t md:border-t-0 md:border-l border-slate-200">
          <Toolbar wallEditorRef={wallEditorRef} />
        </div>
      </main>
    </ProtectedRoute>
  );
}
