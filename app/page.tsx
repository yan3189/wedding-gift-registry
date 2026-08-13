'use client';

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

// ==================== INFORMASI ALAMAT & HEADER ====================
const HERO_BG_IMAGE = 'https://images.unsplash.com/photo-1519741497674-611481863552?q=80&w=2000&auto=format&fit=crop';

const RECIPIENT_NAME = 'Gracia Gita';
const RECIPIENT_PHONE = '081944971533';
const SHIPPING_ADDRESS = 'Jl. Magnesium No.25, Purwantoro, Kec. Blimbing, Kota Malang, Jawa Timur 65126';
// ====================================================================

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

type ShopeeFlowStep = 'education' | 'confirm' | 'form' | 'no_reason';

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [isScrolled, setIsScrolled] = useState(false);
  const [copied, setCopied] = useState(false);

  // Flow Shopee & Modal State
  const [shopeeProduct, setShopeeProduct] = useState<Product | null>(null);
  const [shopeeStep, setShopeeStep] = useState<ShopeeFlowStep | null>(null);
  const [showRedirectNotice, setShowRedirectNotice] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [noReasonOption, setNoReasonOption] = useState<'browsing' | 'unavailable'>('browsing');

  // Form Klaim State
  const [buyerName, setBuyerName] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [greeting, setGreeting] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Ref Timer
  const timer3sRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

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

  // Memisahkan & Mengurutkan: Produk tersedia di atas, yang sudah di-claim di bawah
  const sortedProducts = [...products].sort((a, b) => Number(a.is_claimed) - Number(b.is_claimed));

  const handleCopyAddress = () => {
    const fullAddressText = `Penerima: ${RECIPIENT_NAME} (${RECIPIENT_PHONE})\nAlamat: ${SHIPPING_ADDRESS}`;
    navigator.clipboard.writeText(fullAddressText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const clearShopeeTimers = () => {
    if (timer3sRef.current) clearTimeout(timer3sRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
  };

  const handleCloseShopeeModal = () => {
    clearShopeeTimers();
    setShopeeProduct(null);
    setShopeeStep(null);
    setShowRedirectNotice(false);
    setCountdown(5);
    setErrorMsg('');
  };

  const handleStartShopeeFlow = (product: Product) => {
    clearShopeeTimers();
    setShopeeProduct(product);
    setShopeeStep('education');
    setShowRedirectNotice(false);
    setCountdown(5);

    timer3sRef.current = setTimeout(() => {
      setShowRedirectNotice(true);

      countdownIntervalRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }, 3000);
  };

  const handleProceedToShopee = () => {
    if (!shopeeProduct) return;
    clearShopeeTimers();
    window.open(shopeeProduct.shopee_url, '_blank');
    setShopeeStep('confirm');
  };

  const handleOpenDirectClaimModal = (product: Product) => {
    setShopeeProduct(product);
    setShopeeStep('form');
    setBuyerName('');
    setBuyerPhone('');
    setGreeting('');
    setIsAnonymous(false);
    setErrorMsg('');
  };

  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopeeProduct) return;

    const phoneRegex = /^(\+62|62|0)8[1-9][0-9]{6,10}$/;
    if (!phoneRegex.test(buyerPhone.replace(/\s+/g, ''))) {
      setErrorMsg('Masukkan nomor HP yang valid (contoh: 081234567890).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');

    const { error: claimError } = await supabase.from('claims').insert({
      product_id: shopeeProduct.id,
      buyer_name: buyerName,
      buyer_phone: buyerPhone,
      greeting_message: greeting,
      is_anonymous: isAnonymous,
    });

    if (claimError) {
      setErrorMsg('Gagal menyimpan konfirmasi: ' + claimError.message);
      setSubmitting(false);
      return;
    }

    const { error: productError } = await supabase
      .from('products')
      .update({ is_claimed: true })
      .eq('id', shopeeProduct.id);

    if (productError) {
      setErrorMsg('Gagal memperbarui status kado.');
    } else {
      handleCloseShopeeModal();
      fetchProducts();
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-rose-50/30 text-black pb-28">
      {/* 1. Header Hero Minimalis & Elegan */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-cover bg-center transition-all duration-500 ease-out shadow-md ${
          isScrolled ? 'h-16 sm:h-20' : 'h-screen'
        }`}
        style={{ backgroundImage: `url('${HERO_BG_IMAGE}')` }}
      >
        <div className="w-full h-full bg-black/60 backdrop-blur-[3px] flex flex-col justify-center items-center text-center px-4 transition-all duration-500">
          <div className="max-w-2xl text-white space-y-2">
            {!isScrolled }
            
            <h1
              className={`font-bold transition-all duration-500 ${
                isScrolled ? 'text-base sm:text-xl text-rose-100 tracking-wide' : 'text-3xl sm:text-5xl'
              }`}
            >
              Wishlist Wedding Gift
            </h1>

            {!isScrolled && (
              <>
                <p className="text-gray-200 text-xs sm:text-sm max-w-lg mt-3 leading-relaxed font-light">
                  Kehadiran serta doa restu Anda sudah merupakan kado paling berharga bagi kami. 
                  Sama sekali tidak ada kewajiban untuk membawa kado, namun jika Anda ingin memberikan tanda mata dan membutuhkan ide, berikut beberapa barang yang akan sangat melengkapi rumah baru kami ♡
                </p>
                <div className="pt-8 animate-bounce">
                  <span className="text-xs text-rose-200 border border-white/20 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm">
                    Eksplor Wishlist Kado ↓
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 2. Spacer Pengatur Tinggi Header */}
      <div className="h-screen w-full pointer-events-none" />

      {/* 3. Main Content Grid Kado */}
      <main className="max-w-6xl mx-auto p-4 sm:p-8 relative z-10 -mt-12 sm:-mt-20">
        {loading ? (
          <div className="text-center py-20 text-gray-500 bg-white rounded-3xl shadow-sm">
            Menyiapkan daftar wishlist...
          </div>
        ) : sortedProducts.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-3xl shadow-sm p-8 text-gray-500">
            Belum ada wishlist yang ditampilkan.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedProducts.map((item) => {
              const claim = item.claims && item.claims.length > 0 ? item.claims[0] : null;

              return (
                <div
                  key={item.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition flex flex-col justify-between ${
                    item.is_claimed ? 'border-gray-100 bg-gray-50/50 opacity-75' : 'border-rose-100 hover:shadow-md'
                  }`}
                >
                  <div>
                    <div className="relative h-48 w-full bg-gray-100">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.title}
                          className={`w-full h-full object-cover ${item.is_claimed ? 'grayscale-[30%]' : ''}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 text-sm">
                          Foto Produk
                        </div>
                      )}

                      <div className="absolute top-3 right-3">
                        {item.is_claimed ? (
                          <span className="bg-gray-800/80 backdrop-blur text-white text-[11px] px-3 py-1 rounded-full font-medium">
                            Telah Ditandai ✨
                          </span>
                        ) : (
                          <span className="bg-emerald-600 text-white text-[11px] px-3 py-1 rounded-full font-medium shadow-sm">
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
                        <div className="mt-4 p-3 bg-rose-50/60 rounded-xl border border-rose-100 text-xs space-y-1">
                          <p className="text-gray-700">
                            🎁 Dihadiahkan oleh:{' '}
                            <span className="font-bold text-gray-900">
                              {claim.is_anonymous ? 'Sahabat Anonim' : claim.buyer_name}
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
                        <button
                          onClick={() => handleStartShopeeFlow(item)}
                          className="w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl text-xs transition shadow-sm flex items-center justify-center gap-1"
                        >
                          Hadiahkan via Shopee ↗
                        </button>
                        <button
                          onClick={() => handleOpenDirectClaimModal(item)}
                          className="w-full text-center bg-rose-50 hover:bg-rose-100 text-rose-700 font-medium py-2.5 rounded-xl text-xs transition border border-rose-200"
                        >
                          Saya Sudah Membelikan Ini
                        </button>
                      </>
                    ) : (
                      <button
                        disabled
                        className="w-full text-center bg-gray-100 text-gray-400 font-medium py-2.5 rounded-xl text-xs cursor-not-allowed border border-gray-200/60"
                      >
                        Telah Dihadiahkan Tamu Lain ♡
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. FLOATING ADDRESS BAR */}
      <div
        className={`fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-rose-200 p-3 sm:p-4 shadow-lg transition-all duration-500 transform ${
          isScrolled ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-base sm:text-lg shrink-0">📍</span>
            <div className="min-w-0">
              <p className="text-[11px] sm:text-xs font-bold text-gray-800 truncate">
                Alamat Kirim: {RECIPIENT_NAME} ({RECIPIENT_PHONE})
              </p>
              <p className="text-[10px] sm:text-xs text-gray-500 truncate">
                {SHIPPING_ADDRESS}
              </p>
            </div>
          </div>

          <button
            onClick={handleCopyAddress}
            className={`shrink-0 px-3.5 py-2 sm:px-5 sm:py-2.5 rounded-xl text-xs font-bold transition shadow-sm ${
              copied
                ? 'bg-emerald-600 text-white'
                : 'bg-rose-600 hover:bg-rose-700 text-white'
            }`}
          >
            {copied ? '✓ Tersalin!' : '📋 Salin Alamat'}
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* MODAL SERBAGUNA (EDU / CONFIRM / FORM / NO_REASON) */}
      {/* ==================================================================== */}
      {shopeeProduct && shopeeStep && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          
          {/* A. HALAMAN EDUKASI (1-TAP COPY ALAMAT) */}
          {shopeeStep === 'education' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-gray-100 relative overflow-hidden text-center">
              <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                🛒
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-bold text-gray-800">Petunjuk Singkat Kado</h3>
                <p className="text-xs text-gray-500 leading-relaxed">
                  Ikuti langkah mudah ini sebelum menuju Shopee:
                </p>
              </div>

              <div className="bg-orange-50/50 rounded-2xl p-4 text-left space-y-3.5 border border-orange-100">
                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    1
                  </span>
                  <p className="text-xs text-gray-700 leading-snug pt-0.5">
                    Pilih kado dan beli seperti biasa di <strong>Shopee</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    2
                  </span>
                  <div className="space-y-2 flex-1">
                    <p className="text-xs text-gray-700 leading-snug pt-0.5">
                      Gunakan alamat pengiriman ini saat Checkout:
                    </p>
                    
                    <div
                      onClick={handleCopyAddress}
                      className="bg-white border border-orange-200/80 rounded-xl p-3 text-left shadow-sm cursor-pointer hover:border-orange-400 transition group relative"
                    >
                      <div className="pr-16">
                        <p className="text-[11px] font-bold text-gray-800">
                          {RECIPIENT_NAME} ({RECIPIENT_PHONE})
                        </p>
                        <p className="text-[10px] text-gray-600 leading-relaxed mt-0.5 line-clamp-2">
                          {SHIPPING_ADDRESS}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={`absolute right-2 top-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold transition shadow-xs ${
                          copied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-orange-100 text-orange-700 group-hover:bg-orange-500 group-hover:text-white'
                        }`}
                      >
                        {copied ? '✓ Tersalin' : '📋 Salin'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="bg-orange-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    3
                  </span>
                  <p className="text-xs text-gray-700 leading-snug pt-0.5">
                    <strong>Kembali ke website ini</strong> untuk konfirmasi agar tidak dibeli tamu lain.
                  </p>
                </div>
              </div>

              <div className="min-h-[42px] flex items-center justify-center">
                {showRedirectNotice ? (
                  <div className="text-xs font-semibold text-orange-800 bg-orange-100/90 border border-orange-200 py-2.5 px-4 rounded-xl w-full transition-all duration-500 transform translate-y-0 opacity-100">
                    {countdown > 0 ? (
                      <span>Menyiapkan tautan Shopee ({countdown} dtk)...</span>
                    ) : (
                      <span className="font-bold">Klik tombol di bawah untuk lanjut ke Shopee!</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-gray-400 italic">
                    Memuat petunjuk pengiriman...
                  </p>
                )}
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleCloseShopeeModal}
                  className="w-1/3 py-3 border rounded-xl text-xs font-medium text-gray-500 hover:bg-gray-50 transition"
                >
                  Batal
                </button>
                <button
                  onClick={handleProceedToShopee}
                  className={`w-2/3 py-3 text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center gap-1.5 ${
                    countdown === 0
                      ? 'bg-orange-600 hover:bg-orange-700 animate-pulse'
                      : 'bg-orange-500 hover:bg-orange-600'
                  }`}
                >
                  Lanjut ke Shopee ↗
                </button>
              </div>
            </div>
          )}

          {/* B. HALAMAN KONFIRMASI */}
          {shopeeStep === 'confirm' && (
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-gray-100 relative">
              <button
                onClick={handleCloseShopeeModal}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-lg p-1"
              >
                ✕
              </button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 text-center space-y-3">
                  <div className="h-44 w-full bg-white rounded-xl overflow-hidden shadow-inner">
                    {shopeeProduct.image_url ? (
                      <img
                        src={shopeeProduct.image_url}
                        alt={shopeeProduct.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                        Foto Produk
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-800 text-sm line-clamp-2">
                      {shopeeProduct.title}
                    </h4>
                    <p className="text-rose-600 font-bold text-sm mt-1">
                      Rp {shopeeProduct.price ? shopeeProduct.price.toLocaleString('id-ID') : '0'}
                    </p>
                  </div>
                </div>

                <div className="space-y-6 text-center md:text-left">
                  <div className="space-y-2">
                    <h3 className="text-xl sm:text-2xl font-bold text-gray-800">
                      Apakah Anda jadi menghadiahkan kado ini?
                    </h3>
                    <p className="text-xs text-gray-500 leading-relaxed">
                      Konfirmasi Anda sangat membantu agar tamu lain tidak memilih barang yang sama ♡
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setShopeeStep('form')}
                      className="flex-1 py-3 px-6 rounded-full border-2 border-rose-600 text-rose-600 hover:bg-rose-600 hover:text-white font-bold text-xs transition shadow-sm"
                    >
                      Ya, Sudah Membeli
                    </button>
                    <button
                      onClick={() => setShopeeStep('no_reason')}
                      className="flex-1 py-3 px-6 rounded-full border-2 border-gray-300 text-gray-600 hover:bg-gray-100 font-bold text-xs transition"
                    >
                      Belum / Batal
                    </button>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handleCopyAddress}
                      className="text-xs font-semibold text-rose-600 hover:underline inline-flex items-center gap-1"
                    >
                      <span>📍</span>
                      {copied ? '✓ Alamat Disalin!' : `Salin Alamat Pengiriman ${RECIPIENT_NAME}`}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. FORM ISI NAMA (JIKA KLIK "YES") */}
          {shopeeStep === 'form' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Konfirmasi Kado</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{shopeeProduct.title}</p>
                </div>
                <button
                  onClick={handleCloseShopeeModal}
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
                    placeholder="Contoh: Sarah & Partner"
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
                  <p className="text-[10px] text-gray-400 mt-1">Hanya untuk verifikasi internal mempelai.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Pesan & Doa (Opsional)</label>
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
                    Sembunyikan nama saya dari tamu lain (Anonim)
                  </label>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShopeeStep('confirm')}
                    className="flex-1 py-2.5 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                  >
                    Kembali
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-medium transition disabled:opacity-50"
                  >
                    {submitting ? 'Menyimpan...' : 'Simpan Konfirmasi Kado'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* D. RADIO BUTTON ALASAN */}
          {shopeeStep === 'no_reason' && (
            <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 border border-gray-100">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-base font-bold text-gray-800">Tidak Apa-apa! 😊</h3>
                  <p className="text-xs text-gray-500">Boleh tahu kendalanya?</p>
                </div>
                <button
                  onClick={handleCloseShopeeModal}
                  className="text-gray-400 hover:text-gray-600 text-base leading-none p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 pt-2">
                <label
                  onClick={() => setNoReasonOption('browsing')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    noReasonOption === 'browsing'
                      ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="no_reason"
                    checked={noReasonOption === 'browsing'}
                    onChange={() => setNoReasonOption('browsing')}
                    className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs">Hanya ingin melihat-lihat dulu</span>
                </label>

                <label
                  onClick={() => setNoReasonOption('unavailable')}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    noReasonOption === 'unavailable'
                      ? 'border-rose-500 bg-rose-50/50 text-rose-900 font-medium'
                      : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="no_reason"
                    checked={noReasonOption === 'unavailable'}
                    onChange={() => setNoReasonOption('unavailable')}
                    className="w-4 h-4 text-rose-600 focus:ring-rose-500"
                  />
                  <span className="text-xs">Stok barang di Shopee habis / tidak tersedia</span>
                </label>
              </div>

              <div className="flex gap-2 pt-3">
                <button
                  onClick={() => setShopeeStep('confirm')}
                  className="flex-1 py-2.5 border rounded-xl text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
                >
                  Kembali
                </button>
                <button
                  onClick={handleCloseShopeeModal}
                  className="flex-1 py-2.5 bg-gray-800 hover:bg-gray-900 text-white rounded-xl text-xs font-bold transition shadow-sm"
                >
                  Selesai
                </button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}