"use client";
import { useRef } from "react";
import Toolbar from "./components/Toolbar";
import WallEditor from "./components/WallEditor";

export default function Home() {
  const wallEditorRef = useRef<any>(null);

  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <WallEditor ref={wallEditorRef} />
      <Toolbar wallEditorRef={wallEditorRef} />
    </main>
  );
}
