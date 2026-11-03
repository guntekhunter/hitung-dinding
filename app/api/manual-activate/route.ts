"use server";

import { processPaidOrder } from '@/lib/payment-service';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { merchantOrderId, reference } = await request.json();
    if (!merchantOrderId) {
      return NextResponse.json({ message: 'merchantOrderId is required' }, { status: 400 });
    }
    const result = await processPaidOrder(merchantOrderId, reference);
    const status = result.success ? 200 : 400;
    return NextResponse.json(result, { status });
  } catch (err) {
    console.error('[manual-activate] error', err);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
