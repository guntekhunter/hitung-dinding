import Image from "next/image";
import Button from "./reusable/Button";
import PaymentCard from "./reusable/PaymentCard";

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
    <div className="text-[#303030] font-mona-sans tracking-tight">
      <div className="w-full py-3 px-3 border-b border-b-[#E5E5E5]">
        <Image
          src="/logo.svg"
          alt="Landing page preview"
          width={500}
          height={500}
          className="rounded-md top-[50%] w-[40%]"
        />
      </div>
      <section className="px-4 flex justify-center items-center py-16">
        <div className="space-y-7 w-full">
          <div className="w-full flex justify-center">
            <div className="w-[60%] bg-[#F5F5F5] rounded-full">
              <p className="text-[.8rem] text-center py-[.3rem] px-[.6rem] tracking-tight">
                Aplikasi RAB PVC pertama
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex justify-center">
              <div className="w-[90%]">
                <h1 className="font-mona-sans text-[2rem] font-semibold tracking-tight text-center text-[#303030]">
                  Drafting, RAB, Desain, & Hitung{" "}
                  <span className="font-playfair-display font-semibold text-[#7B6DED] italic">
                    Kebutuhan Satu Aplikasi
                  </span>
                </h1>
              </div>
            </div>
            <div className="flex justify-center w-full">
              <div className="w-[70%]">
                <p className="text-[.8rem] text-center justify-center text-[#7F7F7F] tracking-tight">
                  Buat Desain, Hitung Material, dan Cetak RAB PVC dalam Hitungan
                  Menit.
                </p>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <Button className="text-[.8rem]">Coba Sekarang</Button>
          </div>
          <div className="relative">
            <div className="pl-4">
              <Image
                src="/landing-page/1.webp"
                alt="Landing page preview"
                width={500}
                height={500}
                className="rounded-md"
              />
            </div>
            <Image
              src="/landing-page/2-baru.webp"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md absolute top-[50%] w-[25%]"
            />
          </div>
        </div>
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-10">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
          Sering Mengalami Hal Ini?
        </h2>
        <div className="space-y-6">
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Menggambar di buku.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Salah hitung material.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Pelanggan minta revisi, harus hitung ulang.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Harus bayar desain interior & drafter</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Membuat RAB menggunakan Excel</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Desain AI sulit diedit untuk dinding lebih dari 1.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Revisi desain lama.</p>
          </div>
        </div>
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-10">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
          Akibatnya
        </h2>
        <div className="space-y-6">
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Pelanggan menunggu terlalu lama.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Sales sulit memberikan penawaran saat itu juga.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Estimasi biaya sering berubah karena salah hitung.</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>
              Kontraktor menghabiskan waktu untuk pekerjaan administratif
              daripada mengerjakan proyek.
            </p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Bayar mahal drafter dan desain iterior</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/cross.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Closing menjadi lebih lambat.</p>
          </div>
        </div>
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-10">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
          Dengan satu aplikasi Ini Kamu bisa
        </h2>
        <div className="space-y-6">
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Membuat drafting dinding</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Menghitung luas area secara otomatis</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Menghitung kebutuhan material</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Membuat estimasi biaya & RAB</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Membuat mockup langsung pada foto ruangan pelanggan</p>
          </div>
          <div className="flex space-x-5">
            <Image
              src="/check.svg"
              alt="Landing page preview"
              width={500}
              height={500}
              className="rounded-md top-[50%] w-5"
            />
            <p>Export hasil untuk presentasi</p>
          </div>
        </div>
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-10">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
          Bagaimana Cara kerjanya
        </h2>
        <div className="space-y-6">
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">1</p>
            <p>Gambar area dinding sesuai ukuran</p>
          </div>
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">2</p>
            <p>masukkan material yang kamu mau</p>
          </div>
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">3</p>
            <p>otomatis hitung kebutuhan</p>
          </div>
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">4</p>
            <p>
              buat RAB otomatis berisi kebutuhan material, harga dan desain
              dinding
            </p>
          </div>
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">5</p>
            <p>
              Buat mockup langsung pada foto ruangan pelanggan dan kirim sebagai
              penawaran
            </p>
          </div>
          <div className="flex space-x-5">
            <p className="bg-[#D9D9D9] px-4 font-medium">6</p>
            <p>ubah warna material sesuai selera dan keinginan kastemer.</p>
          </div>
        </div>
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-10">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
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
      </section>
      <section className="px-4 justify-center items-center py-16 space-y-3 bg-[#7B6DED] text-white">
        <div className="w-full flex justify-center">
          <div className="w-[80%]">
            <h2 className="font-bold w-full text-center text-[2rem]">
              Potong Biaya, waktu Desain & Tingkatkan Omzet.
            </h2>
          </div>
        </div>
        <div className="w-full flex justify-center">
          <p className="w-[80%] text-center text-[#]">
            Semakin cepat proposal selesai, semakin banyak proyek yang bisa Anda
            dapatkan.
          </p>
        </div>
      </section>
      <section className="px-4 py-12 space-y-4">
        <h2 className="font-bold w-full text-center text-[1.2rem]">
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
      </section>
    </div>
  );
}
