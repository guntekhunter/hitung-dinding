"use client";

import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";

export default function GlobalLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isExcluded = ["/", "/register", "/login", "/coloring"].includes(pathname);

    if (isExcluded) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-white flex flex-col md:flex-row">
            <Sidebar />
            <div className="flex-1 bg-white h-screen overflow-y-auto pt-[60px] md:pt-0">
                {children}
            </div>
        </div>
    );
}
