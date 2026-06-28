import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { file } = await request.json(); // Data URI base64
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 500 });
        }

        const timestamp = Math.round(new Date().getTime() / 1000).toString();
        const folder = "hitung-dinding";

        // Signature needs to be sorted alphabetically
        // params: folder, timestamp
        const signatureStr = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

        const formData = new FormData();
        formData.append('file', file);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);
        formData.append('folder', folder);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Cloudinary error:", data);
            return NextResponse.json({ error: data.error?.message || 'Upload failed' }, { status: response.status });
        }

        return NextResponse.json({ url: data.secure_url });
    } catch (error: any) {
        console.error("Upload error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
