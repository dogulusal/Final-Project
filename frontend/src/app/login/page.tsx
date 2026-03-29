'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState('admin@newsagency.com');
    const [sifre, setSifre] = useState('admin123456');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'}/api/admin/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, sifre }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Giriş başarısız');
            }

            const data = await response.json();
            const { accessToken, refreshToken } = data.data;

            // Token'ları localStorage'e kaydet
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);

            // Admin paneline yönlendir
            router.push('/admin');
        } catch (err: any) {
            setError(err.message || 'Giriş sırasında bir hata oluştu');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo / Başlık */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-white mb-2">Haberci</h1>
                    <p className="text-slate-400">AI Haber Ajansı — Admin Giriş</p>
                </div>

                {/* Login Form */}
                <div className="bg-slate-800 rounded-lg shadow-2xl p-8 border border-slate-700">
                    {error && (
                        <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
                            <p className="text-red-200 text-sm">{error}</p>
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        {/* Email */}
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-slate-200 mb-2">
                                Email
                            </label>
                            <input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="admin@newsagency.com"
                                required
                            />
                        </div>

                        {/* Şifre */}
                        <div>
                            <label htmlFor="sifre" className="block text-sm font-medium text-slate-200 mb-2">
                                Şifre
                            </label>
                            <input
                                id="sifre"
                                type="password"
                                value={sifre}
                                onChange={(e) => setSifre(e.target.value)}
                                className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                placeholder="••••••••"
                                required
                            />
                        </div>

                        {/* Login Button */}
                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-lg transition"
                        >
                            {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
                        </Button>
                    </form>

                    {/* Test Credentials Info */}
                    <div className="mt-6 p-4 bg-blue-900/10 border border-blue-700/30 rounded-lg">
                        <p className="text-xs text-slate-400 mb-2">📝 Test Bilgileri:</p>
                        <p className="text-xs text-slate-300 font-mono">
                            Email: <span className="text-blue-300">admin@newsagency.com</span>
                        </p>
                        <p className="text-xs text-slate-300 font-mono">
                            Şifre: <span className="text-blue-300">admin123456</span>
                        </p>
                        <p className="text-xs text-slate-400 mt-2">⚠️ Production'da güçlü şifre kullanın!</p>
                    </div>
                </div>

                {/* Footer */}
                <p className="text-center text-slate-500 text-xs mt-6">
                    © 2026 AI Haber Ajansı. Tüm hakları saklıdır.
                </p>
            </div>
        </div>
    );
}
