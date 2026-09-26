import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: Request) {
    try {
        const { url } = await request.json();
        
        if (!url || typeof url !== 'string') {
            return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const apiKey = process.env.CLOUDINARY_API_KEY;
        const apiSecret = process.env.CLOUDINARY_API_SECRET;

        if (!cloudName || !apiKey || !apiSecret) {
            return NextResponse.json({ error: 'Cloudinary credentials missing' }, { status: 500 });
        }

        // Extract public_id from Cloudinary URL
        // Example URL: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/image_name.jpg
        const urlParts = url.split('/');
        const uploadIndex = urlParts.indexOf('upload');
        
        if (uploadIndex === -1) {
            return NextResponse.json({ error: 'Invalid Cloudinary URL' }, { status: 400 });
        }

        // The parts after /upload/v1234567890/ are the public_id
        // Usually it's /upload/{version}/{public_id}.{format}
        const publicIdWithExtension = urlParts.slice(uploadIndex + 2).join('/');
        
        // Remove extension
        const publicId = publicIdWithExtension.substring(0, publicIdWithExtension.lastIndexOf('.')) || publicIdWithExtension;

        const timestamp = Math.round(new Date().getTime() / 1000).toString();

        // Signature needs to be sorted alphabetically
        // params: public_id, timestamp
        const signatureStr = `public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
        const signature = crypto.createHash('sha1').update(signatureStr).digest('hex');

        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('api_key', apiKey);
        formData.append('timestamp', timestamp);
        formData.append('signature', signature);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
            method: 'POST',
            body: formData,
        });

        const data = await response.json();

        if (!response.ok) {
            console.error("Cloudinary error:", data);
            return NextResponse.json({ error: data.error?.message || 'Delete failed' }, { status: response.status });
        }

        return NextResponse.json({ success: true, result: data.result });
    } catch (error: any) {
        console.error("Delete error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
