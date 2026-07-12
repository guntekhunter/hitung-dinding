import { BadgeCheck, Check, ShieldCheck } from "lucide-react";
import Button from "./Button";
import CountdownTimer from "./CountdownTimer";

interface PaymentCardProps {
  oldPrice: string;
  price: string;
  totalValue: string;
  todayPrice: string;
  discountText: string;
  countdown: string;
  features: Feature[];
  buttonText?: string;
}

interface Feature {
  title: string;
  description?: string;
}

export default function PaymentCard({
  oldPrice,
  price,
  totalValue,
  todayPrice,
  discountText,
  countdown,
  features,
  buttonText = "Dapatkan Akses Sekarang",
}: PaymentCardProps) {
  return (
    <div className="bg-white rounded-md p-8 max-w-md w-full border-[#D9D9D9] border-[1.2px]">
      {/* Old Price */}
      <p className="text-center text-3xl font-bold line-through decoration-red-500 decoration-[3px]">
        {oldPrice}
      </p>

      {/* Current Price */}
      <div className="flex justify-center items-start mt-2">
        <span className="text-3xl font-bold mt-2">Rp</span>
        <span className="text-7xl font-bold leading-none">{price}</span>
      </div>

      {/* Discount */}
      <div className="flex justify-center mt-6">
        <div className="bg-[#E8E3FF] rounded-full px-6 py-2">
          <p className="text-xs text-[#6B5CE7] font-medium">{discountText}</p>
        </div>
      </div>

      {/* Countdown */}
      <div className="mt-5 rounded-xl bg-[#E8E3FF] py-4">
        <p className="text-center text-xs text-[#6B5CE7]">
          Harga naik menjadi <strong>199.000</strong> dalam{" "}
          <strong><CountdownTimer initialTime={countdown} /></strong>
        </p>
      </div>

      {/* Features */}
      <div className="mt-8 space-y-6">
        {features.map((feature, index) => (
          <div key={index} className="flex items-start gap-4">
            <Check className="w-6 h-6 text-[#7B6DED] shrink-0 mt-1" />

            <p className="text-[15px] leading-6 text-[#2E2E2E]">
              <span className="font-semibold">{feature.title}</span>{" "}
              {feature.description}
            </p>
          </div>
        ))}
      </div>

      {/* Value */}
      <div className="mt-10 text-center space-y-5">
        <div>
          <p className="text-sm text-gray-500">Total Value</p>
          <p className="text-xl font-bold">{totalValue}</p>
        </div>

        <div>
          <p className="text-sm text-gray-500">Hari Ini</p>
          <p className="text-2xl font-bold">{todayPrice}</p>
        </div>
      </div>

      {/* CTA */}
      <Button className="w-full mt-8">{buttonText}</Button>

      <p className="text-xs text-center text-gray-500 mt-3">
        Harga ini hanya berlaku untuk peluncuran Rapi Studio.
      </p>

      {/* Guarantee */}
      <div className="flex justify-center gap-10 mt-8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#ECE9FF] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#7B6DED]" />
          </div>

          <div>
            <p className="text-sm font-medium">Garansi Uang</p>
            <p className="text-xs text-gray-500">Kembali</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-[#ECE9FF] flex items-center justify-center">
            <BadgeCheck className="w-5 h-5 text-[#7B6DED]" />
          </div>

          <div>
            <p className="text-sm font-medium">Jaminan</p>
            <p className="text-xs text-gray-500">Kepuasan</p>
          </div>
        </div>
      </div>
    </div>
  );
}
