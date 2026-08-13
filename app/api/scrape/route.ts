import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || (!url.includes('shopee') && !url.includes('tokopedia'))) {
      return NextResponse.json(
        { error: 'Link tidak valid atau bukan link marketplace' },
        { status: 400 }
      );
    }

    // Menggunakan Microlink API gratis untuk mengekstrak Metadata (Judul, Foto, Deskripsi)
    const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(url)}`;
    const response = await fetch(microlinkUrl);
    const result = await response.json();

    if (result.status === 'success' && result.data) {
      const data = result.data;

      // Bersihkan judul dari kata 'Shopee Indonesia'
      const rawTitle = data.title || 'Produk Wishlist';
      const cleanTitle = rawTitle.replace(/\s*\|\s*Shopee\s*Indonesia/i, '').trim();

      return NextResponse.json({
        success: true,
        data: {
          title: cleanTitle,
          image_url: data.image?.url || '',
          description: data.description || '',
          shopee_url: data.url || url,
        },
      });
    }

    // Fallback jika Microlink tidak mendapatkan data
    return NextResponse.json({
      success: false,
      message: 'Gagal mengambil metadata otomatis.',
      data: { shopee_url: url }
    });

  } catch (error) {
    console.error('Scrape error:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan sistem saat menarik data.' },
      { status: 500 }
    );
  }
}