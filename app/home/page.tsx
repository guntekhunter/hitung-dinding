import type { Metadata } from "next";
import Home from "../components/Home";

export const metadata: Metadata = {
  title: "Rapi Studio – Drafting, RAB & Desain PVC dalam 1 Aplikasi",
  description:
    "Buat desain, hitung material, dan cetak RAB PVC dalam hitungan menit. Aplikasi RAB PVC pertama untuk kontraktor interior, toko PVC, dan distributor material.",
};

// Cache page as static – eliminates server response latency
export const revalidate = false;

export default function Page() {
    return (
        <div>
            <Home />
        </div>
    )

}