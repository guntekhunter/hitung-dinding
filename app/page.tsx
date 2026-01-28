import Toolbar from "./components/Toolbar";
import WallEditor from "./components/WallEditor";

export default function Home() {
  return (
    <main style={{ display: "flex", height: "100vh" }}>
      <Toolbar />
      <WallEditor />
    </main>
  );
}
