import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Wall, SCALE, Product } from "../store/useCanvasStore";

// Helper to format currency
const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount).replace("Rp", "Rp ");
};

const loadImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
};

export const generateRAB = async (
    walls: Wall[],
    customerInfo: { name: string; phone: string; address: string; surveyorName: string },
    wastePercentage: number,
    wallMetrics: any[],
    totalProductCounts: Record<string, number>,
    materialPrices: Record<string, number>,
    products: Product[],
    companyLogoUrl?: string
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // 1. Header
    if (companyLogoUrl) {
        try {
            const logoLeft = await loadImage(companyLogoUrl);
            const logoHeight = 10;
            const leftRatio = logoLeft.width / logoLeft.height;
            const leftWidth = logoHeight * leftRatio;
            doc.addImage(logoLeft, 'PNG', 14, 10, leftWidth, logoHeight);
        } catch (error) {
            console.error("Error loading custom company logo", error);
        }
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(14, 32, pageWidth - 14, 32);

    // 2. Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("RANCANGAN ANGGARAN DAN BIAYA", pageWidth / 2, 42, { align: "center" });

    // 3. Customer Info
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const startY = 55;
    doc.text(`Nama Costumer  : ${customerInfo.name || "-"}`, 14, startY);
    doc.text(`Nomor Telepon  : ${customerInfo.phone || "-"}`, 14, startY + 6);
    doc.text(`Alamat               : ${customerInfo.address || "-"}`, 14, startY + 12);

    // 4. Wall Detail Table Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("1. Detail Penggunaan Ruangan", 14, 75);

    const wallRows: any[] = [];
    walls.forEach((wall, index) => {
        const metrics = wallMetrics[index];
        if (!metrics) return;

        const xs = wall.points.map(p => p.x);
        const ys = wall.points.map(p => p.y);
        const widthM = (xs.length > 0 ? (Math.max(...xs) - Math.min(...xs)) / SCALE : 0);
        const heightM = (ys.length > 0 ? (Math.max(...ys) - Math.min(...ys)) / SCALE : 0);
        const ukuranText = `${widthM.toFixed(2)} x ${heightM.toFixed(2)}`;

        // List materials used in this room
        const roomMaterials = products.filter(p => (metrics.productAreas[p.id] || 0) > 0 || (metrics.productLengths[p.id] || 0) > 0);
        const materialText = roomMaterials.map(m => m.name).join(", ");
        const areaText = `${metrics.totalDesignArea.toFixed(2)} m²`;

        wallRows.push([
            (index + 1).toString(),
            wall.name,
            ukuranText,
            materialText,
            areaText
        ]);
    });

    autoTable(doc, {
        startY: 78,
        head: [['No', 'Nama Ruangan', 'Ukuran', 'Material Terpasang', 'Luas Net']],
        body: wallRows,
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            4: { halign: 'right', cellWidth: 25 }
        },
        styles: { fontSize: 8, font: 'helvetica' }
    });

    // 5. Material Requirements Table (The Quote)
    const afterWallY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("2. Rincian Kebutuhan Material (Optimized)", 14, afterWallY);

    const materialRows: any[] = [];
    let grandTotalCount = 0;

    products.forEach((product) => {
        const qty = totalProductCounts[product.id] || 0;
        if (qty === 0) return;

        const price = materialPrices[product.id] ?? product.price ?? 0;
        const subtotal = qty * price;
        grandTotalCount += subtotal;
        const unitLabel = product.countType === 'length' ? 'Batang' : 'Lembar';

        materialRows.push([
            (materialRows.length + 1).toString(),
            product.name,
            qty.toString(),
            unitLabel,
            formatIDR(price).replace("Rp ", ""),
            formatIDR(subtotal).replace("Rp ", "")
        ]);
    });

    autoTable(doc, {
        startY: afterWallY + 3,
        head: [['No', 'Daftar Material', 'Qty', 'Satuan', 'Harga Satuan', 'Total']],
        body: materialRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            2: { halign: 'center', cellWidth: 15 },
            3: { halign: 'center', cellWidth: 20 },
            4: { halign: 'right', cellWidth: 35 },
            5: { halign: 'right', cellWidth: 35 }
        },
        styles: { fontSize: 9, font: 'helvetica' }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 0.1;

    // 6. Summary Section (Grand Total)
    autoTable(doc, {
        startY: finalY,
        body: [
            ['Grand Total', formatIDR(grandTotalCount).replace("Rp ", "")],
            ['Total Setelah Diskon', formatIDR(grandTotalCount).replace("Rp ", "")]
        ],
        theme: 'grid',
        columnStyles: {
            0: { halign: 'right', fontStyle: 'bold', cellWidth: pageWidth - 14 - 14 - 35 },
            1: { halign: 'right', fontStyle: 'bold', cellWidth: 35, fillColor: [220, 220, 220] }
        },
        styles: { fontSize: 9 }
    });

    const summaryY = (doc as any).lastAutoTable.finalY + 15;

    // 7. Terms and Conditions
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Total Harga Disepakati = " + formatIDR(grandTotalCount), 14, summaryY);
    doc.text("Dp 50% Dari Harga yang Disepakati = " + formatIDR(grandTotalCount / 2), 14, summaryY + 5);
    doc.text("Biaya diatas tidak termasuk instalasi listrik dan lampu,apabila ada tambahan instalasi listrik di kenakan", 14, summaryY + 10);
    doc.text("biaya tambahan Rp.50.000/titik (diluar material listrik)", 14, summaryY + 15);
    doc.text("Catatan Lain Lain:", 14, summaryY + 20);

    doc.setFont("helvetica", "bold");
    const termsText = "Bila disepakati, maka formulir ini juga berlaku sebagai kontrak kesepakatan kerja antara pelanggan dengan PEVESINDO Setelah disepakati dan ditandatangani oleh manajer development project dan manajer operasional, satu kopi formulir akan diberikan pada pelanggan.";
    const splitTerms = doc.splitTextToSize(termsText, pageWidth - 20);
    doc.setFont("helvetica", "normal");
    doc.text(splitTerms, 14, summaryY + 25);

    const warningText = "Harga yang di sepakati adalah harga yang mengikat pemilihan motif & model dan tidak di perkenankan untuk merubah motif, model yang telah di sepakati apabila ada perubahan luas ruangan maka costumer bersedia menambah biaya sesuai dengan harga yang telah di tentukan. Proyek di nyatakan selesai setelah di buktikan dengan form serah terima proyek yang telah di tanda tangani costumer.";
    const splitWarning = doc.splitTextToSize(warningText, pageWidth - 40);
    doc.setFont("helvetica", "bold");
    doc.text(splitWarning, 14, summaryY + 40);

    // 8. Signature Section
    const sigY = summaryY + 70;
    doc.setFont("helvetica", "normal");
    const dateStr = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
    doc.text(`Makassar, ${dateStr}`, pageWidth - 14, sigY - 10, { align: "right" });

    doc.text("Penerima Kerja", 40, sigY, { align: "center" });
    doc.text("Pemberi Kerja", pageWidth - 40, sigY, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.text(customerInfo.surveyorName || "Muh. Agung", 40, sigY + 30, { align: "center" });
    doc.text("Surveyour", 40, sigY + 35, { align: "center" });

    doc.text(customerInfo.name || "Bapak Nirwan", pageWidth - 40, sigY + 30, { align: "center" });
    doc.text("Pemilik Bangunan", pageWidth - 40, sigY + 35, { align: "center" });

    // Save PDF
    doc.save(`RAB-${customerInfo.name || "Customer"}-${Date.now()}.pdf`);
};
