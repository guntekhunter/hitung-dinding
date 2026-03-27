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
    calculateWallMaterials: (wall: Wall) => any, // Pass the calculation function from Toolbar
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

    // 4. Table Data Preparation
    const tableRows: any[] = [];
    let grandTotal = 0;

    walls.forEach((wall, index) => {
        const calc = calculateWallMaterials(wall);
        const wallMaterials = products.filter(p => (calc.counts[p.id] || 0) > 0);

        if (wallMaterials.length === 0) return;

        // Calculate Wall Dimensions (Bounding box for "Ukuran")
        const xs = wall.points.map(p => p.x);
        const ys = wall.points.map(p => p.y);
        const widthM = (Math.max(...xs) - Math.min(...xs)) / SCALE;
        const heightM = (Math.max(...ys) - Math.min(...ys)) / SCALE;
        const ukuranText = `${widthM.toFixed(2)} x ${heightM.toFixed(2)}`;

        wallMaterials.forEach((product, pIndex) => {
            const qty = calc.counts[product.id];
            const satuan = product.countType === 'length' ? 'Batang' : 'Lembar';
            const price = materialPrices[product.id] ?? product.price ?? 0;
            const subtotal = qty * price;
            grandTotal += subtotal;

            tableRows.push([
                pIndex === 0 ? (index + 1).toString() : "", // No
                pIndex === 0 ? wall.name : "", // Nama Ruangan
                pIndex === 0 ? ukuranText : "", // Ukuran
                product.name, // Material
                qty.toString(), // Qty
                satuan, // Satuan
                formatIDR(price).replace("Rp ", ""), // Harga/Lembar
                formatIDR(subtotal).replace("Rp ", "") // Total
            ]);
        });
    });

    // 5. Generate Table
    autoTable(doc, {
        startY: 75,
        head: [['No', 'Nama Ruangan', 'Ukuran', 'Material', 'Qty', 'Satuan', 'Harga/Lembar', 'Total']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [200, 200, 200], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center' },
        columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            4: { halign: 'center', cellWidth: 15 },
            5: { halign: 'center', cellWidth: 20 },
            6: { halign: 'right' },
            7: { halign: 'right' }
        },
        styles: { fontSize: 8, font: 'helvetica' },
        didParseCell: (data) => {
            // Apply borders similar to the image if needed
        }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 0.1;

    // 6. Summary Section (Grand Total)
    autoTable(doc, {
        startY: finalY,
        body: [
            ['Grand Total', formatIDR(grandTotal).replace("Rp ", "")],
            ['Grand Total Setelah Diskon', formatIDR(grandTotal).replace("Rp ", "")] // Placeholder for discount
        ],
        theme: 'grid',
        columnStyles: {
            0: { halign: 'right', fontStyle: 'bold', cellWidth: pageWidth - 14 - 14 - 40 },
            1: { halign: 'right', fontStyle: 'bold', cellWidth: 40, fillColor: [220, 220, 220] }
        },
        styles: { fontSize: 9 }
    });

    const summaryY = (doc as any).lastAutoTable.finalY + 10;

    // 7. Terms and Conditions
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Total Harga Disepakati = " + formatIDR(grandTotal), 14, summaryY);
    doc.text("Dp 50% Dari Harga yang Disepakati = " + formatIDR(grandTotal / 2), 14, summaryY + 5);
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
