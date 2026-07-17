import Image from "next/image";
import PaymentCard from "./reusable/PaymentCard";


// Lightweight icon component — avoids Next/Image overhead for tiny SVGs
const CheckIcon = () => (
  <img src="/check.svg" alt="" width={20} height={20} className="w-5 h-5 shrink-0" loading="lazy" />
);
const CrossIcon = () => (
  <img src="/cross.svg" alt="" width={20} height={20} className="w-5 h-5 shrink-0" loading="lazy" />
);

export default function Home() {
  const items = [
    "Toko PVC",
    "Kontraktor Interior",
    "Distributor Material",
    "Developer",
    "Interior Designer",
    "Supplier Wall Panel",
  ];
  return (
    <div className="text-[#303030] font-mona-sans tracking-tight bg-white">

      {/* ── Navbar ─────────────────────────────────────────────────────────── */}
      <div className="w-full py-3 px-3 border-b border-b-[#E5E5E5] md:px-8">
        <div className="max-w-6xl mx-auto">
          {/* Plain img for SVG logo — avoids Next/Image JS overhead */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Rapi Studio"
            width={200}
            height={60}
            className="w-[40%] md:w-[160px] h-auto"
            fetchPriority="high"
          />
        </div>
      </div>

      {/* ── Hero ───────────────────────────────────────────────────────────── */}
      <section className="px-4 flex justify-center items-center py-16 md:px-8 md:py-24">
        <div className="w-full max-w-6xl md:flex md:items-center md:gap-12">

          {/* Left: copy */}
          <div className="space-y-7 md:flex-1">
            <div className="w-full flex justify-center md:justify-start">
              <div className="w-[60%] md:w-auto bg-[#F5F5F5] rounded-full">
                <p className="text-[.8rem] text-center py-[.3rem] px-[.6rem] tracking-tight whitespace-nowrap">
                  Aplikasi RAB PVC pertama
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-center md:justify-start">
                <div className="w-[90%] md:w-full">
                  <h1 className="font-mona-sans text-[2rem] md:text-[2.8rem] md:leading-tight font-semibold tracking-tight text-center md:text-left text-[#303030]">
                    Drafting, RAB, Desain, &amp; Hitung{" "}
                    <span className="font-playfair-display font-semibold text-[#7B6DED] italic">
                      Kebutuhan Satu Aplikasi
                    </span>
                  </h1>
                </div>
              </div>
              <div className="flex justify-center md:justify-start w-full">
                <div className="w-[70%] md:w-full">
                  <p className="text-[.8rem] md:text-[1rem] text-center md:text-left text-[#7F7F7F] tracking-tight">
                    Buat Desain, Hitung Material, dan Cetak RAB PVC dalam Hitungan Menit.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex justify-center md:justify-start">
              <a
                href="/payment"
                className="inline-block bg-[#7B6DED] text-white text-[.8rem] md:text-sm font-semibold px-6 py-3 rounded-full hover:bg-[#6a5cd4] transition-colors"
              >
                Coba Sekarang
              </a>
            </div>
          </div>

          {/* Right: image — on mobile stays below the copy */}
          <div className="relative mt-8 md:mt-0 md:flex-1">
            <div className="pl-4 md:pl-0">
              <Image
                src="/landing-page/1.webp"
                alt="Tampilan aplikasi"
                width={600}
                height={450}
                priority
                sizes="(max-width: 768px) 90vw, 50vw"
                className="rounded-md w-full h-auto"
              />
            </div>
            <Image
              src="/landing-page/2-baru.webp"
              alt="Detail fitur"
              width={150}
              height={113}
              loading="lazy"
              sizes="25vw"
              className="rounded-md absolute top-[50%] w-[25%] h-auto"
            />
          </div>

        </div>
      </section>

      {/* ── Sering Mengalami ───────────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-10 md:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Sering Mengalami Hal Ini?
          </h2>
          <div className="space-y-6 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-6 md:space-y-0">
            <div className="flex space-x-5"><CheckIcon /><p>Menggambar di buku.</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Salah hitung material.</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Pelanggan minta revisi, harus hitung ulang.</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Harus bayar desain interior &amp; drafter</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Membuat RAB menggunakan Excel</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Desain AI sulit diedit untuk dinding lebih dari 1.</p></div>
            <div className="flex space-x-5 md:col-span-2"><CheckIcon /><p>Revisi desain lama.</p></div>
          </div>
        </div>
      </section>

      {/* ── Akibatnya ──────────────────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-10 md:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Akibatnya
          </h2>
          <div className="space-y-6 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-6 md:space-y-0">
            <div className="flex space-x-5"><CrossIcon /><p>Pelanggan menunggu terlalu lama.</p></div>
            <div className="flex space-x-5"><CrossIcon /><p>Sales sulit memberikan penawaran saat itu juga.</p></div>
            <div className="flex space-x-5"><CrossIcon /><p>Estimasi biaya sering berubah karena salah hitung.</p></div>
            <div className="flex space-x-5"><CrossIcon /><p>Kontraktor menghabiskan waktu untuk pekerjaan administratif daripada mengerjakan proyek.</p></div>
            <div className="flex space-x-5"><CrossIcon /><p>Bayar mahal drafter dan desain iterior</p></div>
            <div className="flex space-x-5"><CrossIcon /><p>Closing menjadi lebih lambat.</p></div>
          </div>
        </div>
      </section>

      {/* ── Dengan satu aplikasi ───────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-10 md:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Dengan satu aplikasi Ini Kamu bisa
          </h2>
          <div className="space-y-6 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-6 md:space-y-0">
            <div className="flex space-x-5"><CheckIcon /><p>Membuat drafting dinding</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Menghitung luas area secara otomatis</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Menghitung kebutuhan material</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Membuat estimasi biaya &amp; RAB</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Membuat mockup langsung pada foto ruangan pelanggan</p></div>
            <div className="flex space-x-5"><CheckIcon /><p>Export hasil untuk presentasi</p></div>
          </div>
        </div>
      </section>

      {/* ── Cara Kerja ─────────────────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-10 md:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Bagaimana Cara kerjanya
          </h2>
          <div className="space-y-6 md:grid md:grid-cols-2 md:gap-x-12 md:gap-y-6 md:space-y-0">
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">1</p>
              <p>Gambar area dinding sesuai ukuran</p>
            </div>
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">2</p>
              <p>masukkan material yang kamu mau</p>
            </div>
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">3</p>
              <p>otomatis hitung kebutuhan</p>
            </div>
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">4</p>
              <p>buat RAB otomatis berisi kebutuhan material, harga dan desain dinding</p>
            </div>
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">5</p>
              <p>Buat mockup langsung pada foto ruangan pelanggan dan kirim sebagai penawaran</p>
            </div>
            <div className="flex space-x-5">
              <p className="bg-[#D9D9D9] px-4 font-medium shrink-0">6</p>
              <p>ubah warna material sesuai selera dan keinginan kastemer.</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Cocok Digunakan Oleh ───────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-10 md:px-8">
        <div className="max-w-5xl mx-auto space-y-10">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Cocok Digunakan Oleh
          </h2>
          <div className="flex flex-wrap justify-center gap-5 max-w-3xl mx-auto">
            {items.map((item) => (
              <div
                key={item}
                className="border border-[#D9D9D9] rounded-full px-8 py-2"
              >
                <p className="text-sm tracking-tight whitespace-nowrap">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ─────────────────────────────────────────────────────── */}
      <section className="px-4 justify-center items-center py-16 space-y-3 bg-[#7B6DED] text-white md:px-8 md:py-24">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          <h2 className="font-bold text-[2rem] md:text-[2.8rem] md:leading-tight">
            Potong Biaya, waktu Desain &amp; Tingkatkan Omzet.
          </h2>
          <p className="text-white/80 md:text-lg">
            Semakin cepat proposal selesai, semakin banyak proyek yang bisa Anda dapatkan.
          </p>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────────────────────── */}
      <section className="px-4 py-12 space-y-4 md:px-8 md:py-20">
        <div className="max-w-2xl mx-auto space-y-4">
          <h2 className="font-bold w-full text-center text-[1.2rem] md:text-[1.6rem]">
            Aktivasi akun + onboarding + akses trial 30 hari.
          </h2>
          <PaymentCard
            oldPrice="Rp 299.000"
            price="70.000"
            totalValue="Rp 1.748.500"
            todayPrice="Rp 70.000"
            discountText="HEMAT Rp229.000 (76,59%)"
            countdown="10:30:20"
            features={[
              {
                title: "Sesi Onboarding 1-on-1",
              },
              {
                title: "Akses penuh selama 30 hari",
                description:
                  "(Rp250.000) Gunakan Rapi Studio untuk proyek customer Anda.",
              },
              {
                title: "Buat Hingga 15 Proposal Customer",
                description:
                  "(Rp49.500) Presentasikan desain realistis lebih cepat.",
              },
              {
                title: "Hitung Material Otomatis",
                description: "(Rp100.000) Tanpa menghitung panel satu per satu.",
              },
              {
                title: "Drafting Cepat",
                description: "(Rp300.000) Lebih cepat daripada membuat dari nol.",
              },
              {
                title: "Bonus Template Premium",
                description:
                  "(Rp450.000) Siap digunakan untuk berbagai jenis proyek.",
              },
            ]}
          />
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────────── */}
      <footer className="bg-[#1a1a2e] text-white px-6 py-10 md:px-8">
        <div className="max-w-6xl mx-auto md:flex md:justify-between md:items-start md:gap-12">
          <div className="mb-6 md:mb-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="Rapi Studio"
              width={120}
              height={36}
              loading="lazy"
              className="h-8 w-auto brightness-0 invert"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#7B6DED] mb-2">
              Hubungi Support
            </p>
            <a
              href="mailto:guntek2000@gmail.com"
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-[#7B6DED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              guntek2000@gmail.com
            </a>
            <a
              href="tel:085656646637"
              className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 text-[#7B6DED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              0856-5664-6637
            </a>
            <div className="flex items-start gap-2 text-sm text-gray-300">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0 mt-0.5 text-[#7B6DED]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span>Jl. Restika Indah, Kec. Pallangga, Kab. Gowa</span>
            </div>
          </div>

          <div className="border-t border-white/10 pt-6 mt-6 md:border-t-0 md:pt-0 md:mt-0 md:self-end">
            <p className="text-xs text-gray-500 text-center md:text-right">
              © 2026 Rapi Studio. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

