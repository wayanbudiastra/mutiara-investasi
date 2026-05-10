// Palet warna untuk pie chart alokasi — konsisten antar tahun
const PALETTE = [
  '#3B82F6','#EF4444','#10B981','#F59E0B','#8B5CF6',
  '#EC4899','#06B6D4','#F97316','#14B8A6','#6366F1',
  '#84CC16','#E11D48','#0EA5E9','#A855F7','#22C55E',
  '#FB923C','#2DD4BF','#818CF8','#FCD34D','#F472B6',
]

// Hash sederhana dari string → indeks warna yang konsisten
function hashCode(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0
  }
  return h
}

export function getChartColor(kode: string): string {
  return PALETTE[hashCode(kode) % PALETTE.length]
}
