import Link from "next/link";
import Image from "next/image";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-[#303030] font-mona-sans tracking-tight">
      {/* Header */}
      <header className="px-6 py-4 border-b border-[#E8E3FF] bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link href="/home">
            <Image
              src="/logo.svg"
              alt="Rapi Studio"
              width={160}
              height={48}
              className="h-8 w-auto"
            />
          </Link>
          <Link
            href="/payment"
            className="text-sm font-medium text-[#7B6DED] hover:underline"
          >
            Kembali
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-6 py-12 md:py-20 space-y-10">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Kebijakan Privasi
          </h1>
          <p className="text-gray-500 text-sm">
            Terakhir diperbarui: 19 Agustus 2026
          </p>
        </div>

        <div className="space-y-8 text-gray-700 leading-relaxed text-sm md:text-base">
          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              1. Pengantar
            </h2>
            <p>
              Selamat datang di Rapi Studio. Kebijakan Privasi ini menjelaskan
              bagaimana kami mengumpulkan, menggunakan, membagikan, dan
              melindungi informasi pribadi Anda saat Anda menggunakan layanan
              kami, mengunjungi situs web kami, atau melakukan pembelian. Kami
              berkomitmen penuh untuk melindungi privasi dan data Anda.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              2. Informasi yang Kami Kumpulkan
            </h2>
            <p>
              Saat Anda mendaftar atau melakukan pembayaran, kami mengumpulkan
              informasi identifikasi pribadi, yang meliputi namun tidak terbatas
              pada:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Nama lengkap dan/atau Nama Perusahaan</li>
              <li>Alamat Email</li>
              <li>Nomor Telepon / WhatsApp</li>
              <li>
                Alamat IP, jenis browser, data perangkat, dan data interaksi saat menggunakan situs web kami
              </li>
              <li>
                Data yang dikumpulkan melalui Cookies, Web Beacons, Meta Pixel, dan teknologi pelacakan serupa
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              3. Bagaimana Kami Menggunakan Informasi Anda
            </h2>
            <p>
              Informasi yang kami kumpulkan digunakan untuk berbagai tujuan,
              termasuk namun tidak terbatas pada:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Penyediaan Layanan:</strong> Memproses transaksi,
                membuat akun Anda, dan memberikan akses ke fitur-fitur Rapi
                Studio.
              </li>
              <li>
                <strong>Komunikasi:</strong> Mengirimkan pembaruan layanan,
                informasi transaksi, dan dukungan pelanggan via WhatsApp atau
                Email.
              </li>
              <li>
                <strong>Pemasaran & Personalisasi Iklan:</strong> Kami
                menggunakan data Anda (seperti email dan nomor telepon) untuk
                membantu kami menampilkan iklan yang lebih relevan bagi Anda di
                platform pihak ketiga, termasuk Meta (Facebook & Instagram).
                Untuk keperluan pencocokan audiens melalui layanan Meta Conversions API (CAPI),
                informasi kontak seperti alamat email atau nomor telepon 
                diubah menggunakan fungsi hash satu arah (SHA-256) sebelum
                dikirimkan kepada penyedia layanan periklanan.
              </li>
              <li>
                <strong>Peningkatan Kualitas:</strong> Menganalisis bagaimana
                layanan kami digunakan untuk meningkatkan fitur, antarmuka, dan
                performa aplikasi.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              4. Penggunaan Cookies & Teknologi Pelacakan Pihak Ketiga
            </h2>
            <p>
              Kami tidak akan menjual informasi pribadi Anda. Namun, kami membagikan data Anda dengan mitra terpercaya dan pihak ketiga yang membantu operasional kami:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Penyedia Layanan Pembayaran:</strong> Seperti Duitku,
                untuk memproses transaksi secara aman.
              </li>
              <li>
                <strong>Mitra Periklanan & Analitik (Meta & Google):</strong> Pihak ketiga, termasuk Meta (Facebook) dan Google, dapat menggunakan <em>cookies</em>, <em>web beacons</em>, Meta Pixel, dan teknologi serupa lainnya untuk mengumpulkan atau menerima informasi dari situs web kami dan tempat lain di internet. Informasi ini digunakan untuk menyediakan layanan pengukuran dan menargetkan iklan kepada Anda.
              </li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              5. Cara Menolak (Opt-Out) dari Pelacakan Iklan
            </h2>
            <p>
              Anda memiliki hak untuk mengontrol privasi dan menolak (opt-out) dari pengumpulan serta penggunaan informasi Anda untuk penargetan iklan. Anda dapat melakukannya melalui:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Mengatur preferensi iklan langsung di akun Facebook Anda melalui pengaturan <strong>Ad Preferences</strong>.</li>
              <li>Menggunakan alat <em>opt-out</em> industri seperti <a href="http://www.aboutads.info/choices" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">http://www.aboutads.info/choices</a> atau <a href="http://www.youronlinechoices.eu/" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">http://www.youronlinechoices.eu/</a>.</li>
              <li>Mengubah pengaturan <em>cookies</em> pada browser perangkat Anda.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              5. Keamanan Data
            </h2>
            <p>
              Kami menerapkan standar keamanan teknis dan organisasi yang ketat
              untuk melindungi data pribadi Anda dari akses yang tidak sah,
              modifikasi, atau pengungkapan. Proses <em>hashing</em> digunakan
              sebelum kami membagikan data Anda ke platform iklan.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">6. Hak Anda</h2>
            <p>
              Anda berhak untuk meminta salinan data pribadi yang kami simpan,
              meminta koreksi data yang tidak akurat, atau meminta penghapusan
              akun Anda. Anda juga berhak untuk menarik persetujuan atas
              penggunaan data Anda untuk keperluan pemasaran pihak ketiga kapan
              saja dengan menghubungi dukungan pelanggan kami.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-gray-900">
              7. Hubungi Kami
            </h2>
            <p>
              Jika Anda memiliki pertanyaan lebih lanjut mengenai Kebijakan
              Privasi ini, silakan hubungi kami melalui:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Email: guntek2000@gmail.com</li>
              <li>Telepon / WhatsApp: 0856-5664-6637</li>
            </ul>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#F8F7FF] py-6 border-t border-[#E8E3FF] text-center text-sm text-gray-500">
        <p>© 2026 Rapi Studio. All rights reserved.</p>
      </footer>
    </div>
  );
}
