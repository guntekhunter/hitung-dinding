"use client";

import { useState } from "react";
import { useAuthStore } from "../store/useAuthStore";
import { logoutUser } from "../utils/auth";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Menu, X, LucideIcon, Folder, Palette, Upload } from "lucide-react";

type MenuItem = {
    label: string;
    icon: LucideIcon;
    active?: boolean;
    href?: string;
};

const menuItems: MenuItem[] = [
    { label: "Projects", icon: Folder, href: "/projects" },
    { label: "Upload Material", icon: Upload, href: "/upload-material" },
];

export default function Sidebar() {
    const { user, company, clearSession } = useAuthStore();
    const userName = user?.name || "Admin";
    const initial = userName ? userName.charAt(0).toUpperCase() : "M";
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const router = useRouter();

    const handleLogout = async (e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await logoutUser();
            clearSession();
            router.push("/login");
        } catch (err) {
            console.error("Logout failed:", err);
            alert("Logout failed. Please try again.");
        }
    };

    const ProfileModal = ({ position }: { position: "desktop" | "mobile" }) => (
        <>
            <div
                className="fixed inset-0 z-40"
                onClick={(e) => { e.stopPropagation(); setIsProfileOpen(false); }}
            />
            <div
                className={`absolute bg-[#232323] p-2 rounded-xl w-[180px] z-[9999] flex flex-col gap-3 cursor-default ${position === "desktop" ? "top-[60px] left-4" : "top-[40px] left-0"
                    }`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-2 p-1">
                    <div className="w-9 h-9 rounded-full flex shrink-0 items-center justify-center text-white font-medium bg-[#7B6DED] text-[14px]">
                        {initial}
                    </div>
                    <div className="flex flex-col truncate">
                        <span className="text-white font-medium text-sm truncate">{user?.name || "User"}</span>
                        <span className="text-gray-400 text-xs truncate">{company?.name || "Company"}</span>
                    </div>
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); handleLogout(e); }}
                    className="w-full bg-[#EA726B] hover:bg-[#D9615A] text-white py-2 rounded-lg transition-colors text-[14px]"
                >
                    Logout
                </button>
            </div>
        </>
    );

    return (
        <>
            {/* Desktop Sidebar */}
            <div className="w-[240px] border-r border-gray-200 bg-white flex-shrink-0 flex-col h-screen sticky top-0 overflow-y-auto hidden md:flex">
                {/* User Profile */}
                <div className="relative">
                    <div
                        className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <div className="w-6 h-6 rounded-full bg-[#7B6DED] flex items-center justify-center text-white text-xs font-medium shrink-0">
                                {initial}
                            </div>
                            <span className="text-[14px] font-medium text-gray-800 truncate">{userName}</span>
                            <ChevronDown size={14} className="text-gray-500 shrink-0" />
                        </div>
                        <div className="relative shrink-0 ml-2">
                            <Bell size={18} className="text-gray-600" />
                            <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></div>
                        </div>
                    </div>
                    {isProfileOpen && <ProfileModal position="desktop" />}
                </div>

                {/* Menu Items */}
                <div className="px-2 py-2 flex flex-col gap-0.5">
                    {menuItems.map((item) => {
                        const Icon = item.icon;
                        return (
                            <div
                                key={item.label}
                                className={`flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors ${item.active
                                    ? "bg-[#eaf4fc] text-[#1a73e8]"
                                    : "hover:bg-gray-100 text-gray-700"
                                    }`}
                                onClick={() => {
                                    router.push(item.href || "#");
                                }}
                            >
                                <Icon size={16} className={item.active ? "text-[#1a73e8]" : "text-gray-600"} />
                                <span className={`text-[14px] ${item.active ? "font-medium" : ""}`}>{item.label}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Top Navigation Bar */}
            <div className="md:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 flex justify-between items-center h-[60px] z-[100] px-4 shadow-sm">
                {/* User Avatar */}
                <div className="relative" onClick={() => setIsProfileOpen(!isProfileOpen)}>
                    <div className="w-[32px] h-[32px] rounded-full bg-[#7B6DED] flex items-center justify-center text-white text-[12px] font-medium cursor-pointer">
                        {initial}
                    </div>
                    {isProfileOpen && <ProfileModal position="mobile" />}
                </div>

                {/* Hamburger */}
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="text-gray-600 p-1 active:bg-gray-100 rounded-md"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Collapsible Menu */}
            {isMobileMenuOpen && (
                <div className="md:hidden fixed inset-0 top-[60px] bg-white z-[90] flex flex-col pt-2 overflow-y-auto">
                    <div className="flex flex-col gap-1 px-2">
                        {menuItems.map((item) => {
                            const Icon = item.icon;
                            return (
                                <div
                                    key={item.label}
                                    className={`flex items-center gap-3 px-4 py-3.5 rounded-md cursor-pointer transition-colors ${item.active
                                        ? "bg-[#eaf4fc] text-[#1a73e8]"
                                        : "hover:bg-gray-100 text-gray-700"
                                        }`}
                                    onClick={() => {
                                        router.push(item.href || "#");
                                        setIsMobileMenuOpen(false);
                                    }}
                                >
                                    <Icon size={20} className={item.active ? "text-[#1a73e8]" : "text-gray-600"} />
                                    <span className={`text-[15px] ${item.active ? "font-medium" : ""}`}>{item.label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
}
