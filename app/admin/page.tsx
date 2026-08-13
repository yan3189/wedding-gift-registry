'use client';

import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

type Claim = {
  id: string;
  buyer_name: string;
  buyer_phone: string;
  greeting_message: string;
  is_anonymous: boolean;
  created_at: string;
};

type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  price: number;
  shopee_url: string;
  is_claimed: boolean;
  created_at: string;
  claims?: Claim[];
};

export default function AdminDashboard() {
  const router = useRouter();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [shopeeUrl, setShopeeUrl] = useState('');
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.push('/login');
      } else {
        setLoadingAuth(false);
        fetchProducts();
      }
    };
    checkUser();
  }, [router]);

  const fetchProducts = async () => {
    setLoadingData(true);
    const { data, error } = await supabase
      .from('products')
      .select('*, claims(*)')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setProducts(data as unknown as Product[]);
    }
    setLoadingData(false);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !shopeeUrl) return;
    setSaving(true);

    const { error } = await supabase.from('products').insert({
      title,
      price: parseFloat(price) || 0,
      image_url: imageUrl,
      description,
      shopee_url: shopeeUrl,
      is_claimed: false,
    });

    if (!error) {
      setShopeeUrl('');
      setTitle('');
      setPrice('');
      setImageUrl('');
      setDescription('');
      fetchProducts();
    } else {
      alert('Gagal menyimpan produk: ' + error.message);
    }
    setSaving(false);
  };

  const handleDuplicate = async (prod: Product) => {
    const { error } = await supabase.from('products').insert({
      title: prod.title,
      price: prod.price,
      image_url: prod.image_url,
      description: prod.description,
      shopee_url: prod.shopee_url,
      is_claimed: false,
    });

    if (!error) {
      fetchProducts();
    } else {
      alert('Gagal menduplikat: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus produk ini?')) return;
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (!error) fetchProducts();
  };

  const handleExportExcel = () => {
    const rows = products.map((p) => {
      const claim = p.claims && p.claims.length > 0 ? p.claims[0] : null;
      return {
        'Nama Produk': p.title,
        'Harga (Rp)': p.price,
        'Status': p.is_claimed ? 'TERBELI' : 'Tersedia',
        'Nama Pembeli': claim ? claim.buyer_name : '-',
        'No HP Pembeli': claim ? claim.buyer_phone : '-',
        'Pesan Ucapan': claim ? claim.greeting_message : '-',
        'Status Tampilan': claim ? (claim.is_anonymous ? 'Anonim' : 'Tampil Nama') : '-',
        'Link Shopee': p.shopee_url,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Wishlist');
    XLSX.writeFile(workbook, `Wishlist_Wedding_Rekap_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loadingAuth) {
    return <div className="p-8 text-center text-gray-500">Memeriksa sesi admin...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 text-black p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Admin Wishlist</h1>
            <p className="text-sm text-gray-500">Kelola kado & rekap ucapan pembeli</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleExportExcel}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Export Excel
            </button>
            <button
              onClick={handleLogout}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-semibold transition"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Form Tambah Produk */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-base font-bold text-gray-800">Tambah Kado Baru</h2>

          <form onSubmit={handleSaveProduct} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Link Shopee *</label>
                <input
                  type="url"
                  required
                  value={shopeeUrl}
                  onChange={(e) => setShopeeUrl(e.target.value)}
                  placeholder="https://shopee.co.id/... atau https://s.shopee.co.id/..."
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Nama Produk *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nama barang..."
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Estimasi Harga (Rp) *</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="750000"
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">URL Foto Produk (Copy Image Address)</label>
                <input
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://cf.shopee.co.id/file/..."
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black bg-white"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-gray-700 mb-1">Catatan Tambahan (Opsional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Varian warna, ukuran, dsb."
                  className="w-full px-3 py-2 border rounded-xl text-xs text-black bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={saving || !title || !shopeeUrl}
              className="w-full bg-rose-600 text-white py-2.5 rounded-xl text-xs font-bold hover:bg-rose-700 transition disabled:opacity-50"
            >
              {saving ? 'Menyimpan...' : 'Simpan Kado'}
            </button>
          </form>
        </div>

        {/* List Kado Rapi Tanpa Scroll Samping */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-gray-800">
            Daftar Kado Saat Ini ({products.length})
          </h2>

          {loadingData ? (
            <p className="text-gray-500 text-xs">Memuat data...</p>
          ) : products.length === 0 ? (
            <p className="text-gray-500 text-xs">Belum ada kado.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {products.map((p) => {
                const claim = p.claims && p.claims.length > 0 ? p.claims[0] : null;

                return (
                  <div
                    key={p.id}
                    className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between space-y-3"
                  >
                    <div className="flex gap-3 items-start">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-16 h-16 object-cover rounded-xl border flex-shrink-0" />
                      ) : (
                        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center text-[10px] text-gray-400 flex-shrink-0">No Image</div>
                      )}

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            p.is_claimed ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {p.is_claimed ? 'TERBELI' : 'Tersedia'}
                          </span>
                          <span className="text-xs font-bold text-gray-800">
                            Rp {p.price ? p.price.toLocaleString('id-ID') : '0'}
                          </span>
                        </div>
                        <h3 className="font-bold text-gray-800 text-sm truncate">{p.title}</h3>
                        <a href={p.shopee_url} target="_blank" rel="noreferrer" className="text-[11px] text-rose-600 hover:underline block truncate">
                          Link Shopee ↗
                        </a>
                      </div>
                    </div>

                    {/* Jika Terbeli, Tampilkan Detail Pembeli */}
                    {p.is_claimed && claim && (
                      <div className="bg-rose-50/60 p-3 rounded-xl text-xs space-y-1 border border-rose-100">
                        <p className="font-bold text-gray-800">
                          🎁 {claim.buyer_name} {claim.is_anonymous && <span className="text-gray-400 font-normal">(Anonim)</span>}
                        </p>
                        <p className="text-gray-600">📱 {claim.buyer_phone}</p>
                        {claim.greeting_message && (
                          <p className="text-gray-500 italic">"{claim.greeting_message}"</p>
                        )}
                      </div>
                    )}

                    {/* Tombol Aksi */}
                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-50">
                      <button
                        onClick={() => handleDuplicate(p)}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1.5 rounded-xl font-medium transition"
                      >
                        Duplikat
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1.5 rounded-xl font-medium transition"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}