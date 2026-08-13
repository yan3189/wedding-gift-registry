'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Link Foto Background Header
const HERO_BG_IMAGE = 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2000&auto=format&fit=crop';

type Claim = {
  buyer_name: string;
  greeting_message: string;
  is_anonymous: boolean;
};

type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  shopee_url: string;
  is_claimed: boolean;
  claims?: Claim[];
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);

  // Form Modal Klaim State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [greeting, setGreeting] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Deteksi Scroll Halus tanpa Layout Shift Loop
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 120) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, claims(buyer_name, greeting_message, is_anonymous)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data as unknown as Product[]);
    }
    setLoading(false);
  };

  const handleOpenClaimModal = (product: Product) => {
    setSelectedProduct(product);
    setBuyerName('');
    setBuyerPhone('');
    setGreeting('');
    setIsAnonymous(false);
    setErrorMsg('');
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;

    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(buyerPhone.replace(/\s+/g, ''))) {
      setErrorMsg('Masukkan nomor HP Indonesia yang valid (contoh: 081234567890).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const { error: claimError } = await supabase.from('claims').insert({
      product_id: selectedProduct.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      greeting_message: greeting,
      is_anonymous: isAnonymous,
    });

    if (claimError) {
      setErrorMsg('Gagal menyimpan: ' + claimError.message);
      setSubmitting(false);
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ is_claimed: true })
      .eq('id', selectedProduct.id);

    if (productError) {
      setErrorMsg('Gagal memperbarui status produk.');
    } else {
      setSelectedProduct(null);
      fetchProducts();
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-rose-50/30 text-black">
      {/* 1. Header Fixed yang Menyempit Mulus Tanpa Glitch */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-cover bg-center transition-all duration-500 ease-out shadow-md ${
          isScrolled ? 'h-48 sm:h-52' : 'h-screen'
        }`}
        style={{ backgroundImage: `url('${HERO_BG_IMAGE}')` }}
      >
        {/* Overlay Gelap untuk Keterbacaan Teks */}
        <div className="w-full h-full bg-black/55 backdrop-blur-[2px] flex flex-col justify-center items-center text-center px-4 transition-all duration-500">
          <div className="max-w-2xl text-white space-y-2">
            <p className="text-xs sm:text-sm font-semibold tracking-widest text-rose-300 uppercase">
              Wedding Registry
            </p>
            <h1
              className={`font-bold transition-all duration-500 ${
                isScrolled ? 'text-lg sm:text-2xl' : 'text-3xl sm:text-5xl'
              }`}
            >
              Daftar Wishlist Kado Pernikahan
            </h1>
            <p
              className={`text-gray-200 transition-all duration-500 mx-auto ${
                isScrolled
                  ? 'text-[11px] sm:text-xs max-w-md line-clamp-1 opacity-80'
                  : 'text-sm sm:text-base max-w-lg mt-2 leading-relaxed'
              }`}
            >
              Kehadiran & doa restu Anda adalah hadiah terindah bagi kami. Namun jika Anda ingin memberikan tanda mata, berikut daftar barang yang sedang kami butuhkan.
            </p>

            {!isScrolled && (
              <div className="pt-8 animate-bounce">
                <span className="text-xs text-rose-200 border border-white/20 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                  Scroll ke bawah untuk melihat kado ↓
                </span>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* 2. Spacer Perekam Tinggi Halaman (Mencegah Glitch Loop) */}
      <div className="h-screen w-full pointer-events-none" />

      {/* 3. Main Content List Kado (Meluncur Di Atas Spacer) */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 relative z-10 -mt-16 sm:-mt-24">
        {loading ? (
          <div className="text-center py-20 text-gray-500 bg-white rounded-3xl shadow-sm">
            Memuat daftar kado...
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm p-8 text-gray-500">
            Belum ada kado yang ditampilkan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {products.map((item) => {
              const claim = item.claims && item.claims.length > 0 ? item.claims[0] : null;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition flex flex-col justify-between ${
                    item.is_claimed ? 'border-gray-200 opacity-85' : 'border-rose-100 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="relative h-48 w-full bg-gray-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          Foto Produk
                        </div>
                      )}

                      <div className="absolute top-3 right-3">
                        {item.is_claimed ? (
                          <span className="bg-gray-900/80 backdrop-blur text-white text-xs px-3 py-1 rounded-full font-medium">
                            Terbeli
                          </span>
                        ) : (
                          <span className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full font-medium shadow-sm">
                            Tersedia
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-5 space-y-2">
                      <h3 className="font-bold text-gray-800 text-base leading-snug line-clamp-2">
                        {item.title}
                      </h3>
                      <p className="text-rose-600 font-bold text-base">
                        Rp {item.price ? item.price.toLocaleString('id-ID') : '0'}
                      </p>
                      {item.description && (
                        <p className="text-gray-500 text-xs line-clamp-2">{item.description}</p>
                      )}

                      {item.is_claimed && claim && (
                        <div className="mt-4 p-3 bg-rose-50/70 rounded-xl border border-rose-100 text-xs space-y-1">
                          <p className="text-gray-600">
                            🎁 Dibelikan oleh:{' '}
                            <span className="font-bold text-gray-800">
                              {claim.is_anonymous ? 'Seseorang (Anonim)' : claim.buyer_name}
                            </span>
                          </p>
                          {claim.greeting_message && (
                            <p className="text-gray-500 italic">"{claim.greeting_message}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="p-5 pt-0 space-y-2">
                    {!item.is_claimed ? (
                      <>
                        <a
                          href={item.shopee_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-sm"
                        >
                          Beli di Shopee ↗
                        </a>
                        <button
                          onClick={() => handleOpenClaimModal(item)}
                          className="w-full text-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-2.5 rounded-xl text-xs transition border border-rose-200"
                        >
                          Saya Sudah Membeli Ini
                        </button>
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full text-center bg-gray-100 text-gray-400 font-medium py-2.5 rounded-xl text-xs cursor-not-allowed"
                      >
                        Barang Sudah Ada Yang Membelikan
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal Popup Konfirmasi Klaim */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-base font-bold text-gray-800">Konfirmasi Pembelian</h3>
                <p className="text-xs text-gray-500 line-clamp-1">{selectedProduct.title}</p>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600 text-base leading-none p-1"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs text-center font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleSubmitClaim} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Anda *</label>
                <input
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Contoh: Budi Santoso"
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nomor WhatsApp / HP *</label>
                <input
                  type="tel"
                  required
                  value={buyerPhone}
                  onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="081234567890"
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black outline-none focus:ring-2 focus:ring-rose-500"
                />
                <p className="text-[10px] text-gray-400 mt-1">Nomor HP hanya untuk konfirmasi mempelai.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Pesan Ucapan (Opsional)</label>
                <textarea
                  rows={2}
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                  placeholder="Selamat menempuh hidup baru ya!"
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="anonymousToggle"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 text-rose-600 rounded focus:ring-rose-500 cursor-pointer"
                />
                <label htmlFor="anonymousToggle" className="text-xs text-gray-700 cursor-pointer select-none">
                  Sembunyikan nama dari tamu lain (Anonim)
                </label>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedProduct(null)}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium transition disabled:opacity-50"
                >
                  {submitting ? 'Menyimpan...' : 'Konfirmasi Kado'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}