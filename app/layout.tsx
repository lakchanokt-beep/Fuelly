import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Fuelly — บันทึกน้ำมันแบบสบายใจ',
  description: 'บันทึกค่าใช้จ่ายและติดตามประสิทธิภาพการใช้น้ำมันของคุณในที่เดียว',
  openGraph: {
    title: 'Fuelly — บันทึกน้ำมันแบบสบายใจ',
    description: 'เห็นค่าใช้จ่าย ระยะทาง และประสิทธิภาพการใช้น้ำมันได้ชัดเจนในที่เดียว',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Fuelly dashboard' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fuelly — บันทึกน้ำมันแบบสบายใจ',
    description: 'เห็นค่าใช้จ่าย ระยะทาง และประสิทธิภาพการใช้น้ำมันได้ชัดเจนในที่เดียว',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
