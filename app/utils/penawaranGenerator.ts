import jsPDF from "jspdf";
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

export const generatePenawaran = async (
    walls: Wall[],
    customerInfo: { name: string; phone: string; address: string; surveyorName: string },
    wastePercentage: number,
    wallMetrics: any[],
    totalProductCounts: Record<string, number>,
    materialPrices: Record<string, number>,
    products: Product[],
    companyLogoUrl?: string,
    wallImages?: string[],
    companyName?: string,
    ceilingPanels?: Record<string, any>,
    manualMaterials?: Array<{ id: string, name: string, quantity: number, price: number }>
) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Calculate proportional product distribution to match exact RAB totals
    const distributedCounts: Record<string, number[]> = {}; // [wallIndex]: count
    products.forEach(p => {
        const total = totalProductCounts[p.id] || 0;
        if (total === 0) return;
        
        const wallRaws = walls.map((_, i) => {
            const metrics = wallMetrics[i];
            if (!metrics) return 0;
            const area = metrics.productAreas[p.id] || 0;
            const length = metrics.productLengths[p.id] || 0;
            return area + length;
        });
        
        const sumRaw = wallRaws.reduce((a, b) => a + b, 0);
        distributedCounts[p.id] = new Array(walls.length).fill(0);
        
        if (sumRaw > 0) {
            let assigned = 0;
            for (let i = 0; i < walls.length - 1; i++) {
                const count = Math.round(total * (wallRaws[i] / sumRaw));
                distributedCounts[p.id][i] = count;
                assigned += count;
            }
            distributedCounts[p.id][walls.length - 1] = Math.max(0, total - assigned);
        }
    });

    let cursorY = 20;

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PENAWARAN", pageWidth / 2, cursorY, { align: "center" });
    cursorY += 10;
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Customer: ${customerInfo.name || "-"}`, 14, cursorY);
    cursorY += 15;

    let totalWallMaterialsCost = 0;

    // Walls
    for (let i = 0; i < walls.length; i++) {
        const wall = walls[i];
        
        // Check if page break needed
        if (cursorY + 60 > pageHeight) {
            doc.addPage();
            cursorY = 20;
        }

        const startY = cursorY;
        const imgMaxW = 80;
        const imgMaxH = 50;

        let imgH = 0;
        let imgW = 0;
        if (wallImages && wallImages[i]) {
            try {
                const img = await loadImage(wallImages[i]);
                const ratio = img.width / img.height;
                imgW = imgMaxW;
                imgH = imgW / ratio;
                if (imgH > imgMaxH) {
                    imgH = imgMaxH;
                    imgW = imgH * ratio;
                }
                doc.addImage(img.src, 'PNG', 14, cursorY, imgW, imgH);
                doc.setDrawColor(150);
                doc.rect(14, cursorY, imgW, imgH);
            } catch (e) {
                doc.text("[Image Error]", 14, cursorY + 10);
            }
        } else {
            doc.text("[No Image]", 14, cursorY + 10);
        }

        // Materials on the right
        const textX = 14 + imgMaxW + 10;
        let textY = cursorY + 5;

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.text(`Ruangan: ${wall.name}`, textX, textY);
        textY += 6;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);

        let wallTotal = 0;

        if (wall.type === 'ceiling' && ceilingPanels && ceilingPanels[wall.id]) {
            const p = ceilingPanels[wall.id];
            const price = materialPrices[`ceiling-${wall.id}`] || 0;
            const sub = p.count * price;
            wallTotal += sub;
            doc.text(`Plafon ${p.length}m: ${p.count} x ${formatIDR(price)} = ${formatIDR(sub)}`, textX, textY);
            textY += 5;

            if (p.optimization?.lisDindingSticks > 0) {
                const lPrice = materialPrices[`lisDinding-${wall.id}`] || 0;
                const lSub = p.optimization.lisDindingSticks * lPrice;
                wallTotal += lSub;
                doc.text(`Lis Dinding: ${p.optimization.lisDindingSticks} x ${formatIDR(lPrice)} = ${formatIDR(lSub)}`, textX, textY);
                textY += 5;
            }
            if (p.optimization?.lisSikuSticks > 0) {
                const sPrice = materialPrices[`lisSiku-${wall.id}`] || 0;
                const sSub = p.optimization.lisSikuSticks * sPrice;
                wallTotal += sSub;
                doc.text(`Lis Siku: ${p.optimization.lisSikuSticks} x ${formatIDR(sPrice)} = ${formatIDR(sSub)}`, textX, textY);
                textY += 5;
            }
        } else {
            products.forEach(p => {
                if (!distributedCounts[p.id]) return;
                const qty = distributedCounts[p.id][i];
                if (qty > 0) {
                    const price = materialPrices[p.id] ?? p.price ?? 0;
                    const sub = qty * price;
                    wallTotal += sub;
                    doc.text(`${p.name}: ${qty} x ${formatIDR(price)} = ${formatIDR(sub)}`, textX, textY);
                    textY += 5;
                }
            });
        }

        doc.line(textX, textY, pageWidth - 14, textY);
        textY += 5;
        doc.setFont("helvetica", "bold");
        doc.text(`Subtotal: ${formatIDR(wallTotal)}`, textX, textY);
        doc.setFont("helvetica", "normal");
        
        totalWallMaterialsCost += wallTotal;
        cursorY = Math.max(startY + imgMaxH + 10, textY + 15);
    }

    // After all walls, totals section
    if (cursorY + 60 > pageHeight) {
        doc.addPage();
        cursorY = 20;
    }

    doc.line(14, cursorY, pageWidth - 14, cursorY);
    cursorY += 10;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(`Total Wall & Ceiling Materials = ${formatIDR(totalWallMaterialsCost)}`, 14, cursorY);
    cursorY += 8;

    let manualTotal = 0;
    if (manualMaterials && manualMaterials.length > 0) {
        doc.setFont("helvetica", "normal");
        manualMaterials.forEach(m => {
            if (m.name && m.quantity > 0) {
                const sub = m.quantity * m.price;
                manualTotal += sub;
                doc.text(`- ${m.name}: ${m.quantity} x ${formatIDR(m.price)} = ${formatIDR(sub)}`, 20, cursorY);
                cursorY += 6;
            }
        });
        
        doc.line(20, cursorY, pageWidth - 14, cursorY);
        cursorY += 5;
        doc.setFont("helvetica", "bold");
        doc.text(`Total Tambahan = ${formatIDR(manualTotal)}`, 20, cursorY);
        cursorY += 10;
    }

    doc.line(14, cursorY, pageWidth - 14, cursorY);
    cursorY += 8;
    
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const grandTotal = totalWallMaterialsCost + manualTotal;
    doc.text(`GRAND TOTAL: ${formatIDR(grandTotal)}`, 14, cursorY);

    // Save PDF
    doc.save(`Penawaran-${customerInfo.name || "Customer"}-${Date.now()}.pdf`);
};
